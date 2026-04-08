import { Router, Request, Response, NextFunction } from 'express';
import { google } from 'googleapis';
import { kundenIntegrationSpeichern } from '../dienste/integrationen.dienst';
import { logger } from '../hilfsfunktionen/logger';

/**
 * OAuth-Callbacks mit STATISCHER Redirect-URI.
 * Die kundeId wird über den `state`-Parameter mitgeführt — so reicht für
 * Google/Microsoft eine einzige registrierte Redirect-URI für alle Kunden.
 *
 * Routen:
 *   GET /api/v1/oauth/google/callback?code=...&state=<kundeId>
 *   GET /api/v1/oauth/outlook/callback?code=...&state=<kundeId>
 */
export const oauthRouter = Router();

// Hilfsfunktion: state-Parameter validieren und kundeId extrahieren
function kundeIdAusState(state: unknown): string | null {
  if (typeof state !== 'string' || !state) return null;
  // Schutz: nur UUIDs erlauben
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(state)) {
    return null;
  }
  return state;
}

// Hilfsfunktion: Statische Redirect-URI für Google
export function googleRedirectUri(): string {
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  return `${apiBaseUrl}/api/v1/oauth/google/callback`;
}

// Hilfsfunktion: Statische Redirect-URI für Outlook
export function outlookRedirectUri(): string {
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  return `${apiBaseUrl}/api/v1/oauth/outlook/callback`;
}

// ──────────────────────────────────────────────
// Google Callback
// ──────────────────────────────────────────────
oauthRouter.get('/google/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    // Fehler von Google direkt durchreichen
    if (error) {
      logger.warn(`Google OAuth abgelehnt: ${String(error)}`);
      res.redirect(`${frontendUrl}/kunden?google_calendar=fehler&grund=${encodeURIComponent(String(error))}`);
      return;
    }

    const kundeId = kundeIdAusState(state);
    if (!kundeId) {
      res.status(400).send('Ungültiger oder fehlender state-Parameter.');
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).send('Authorization Code fehlt.');
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientGeheimnis = process.env.GOOGLE_CLIENT_GEHEIMNIS;
    if (!clientId || !clientGeheimnis) {
      res.status(500).send('Google OAuth nicht konfiguriert (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_GEHEIMNIS fehlen).');
      return;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientGeheimnis, googleRedirectUri());
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      logger.warn(`Google OAuth: Kein refresh_token erhalten für Kunde ${kundeId}`);
      res.redirect(
        `${frontendUrl}/kunden/${kundeId}?google_calendar=fehler&grund=${encodeURIComponent(
          'Kein Refresh-Token. Bitte App-Berechtigung in Google widerrufen und erneut verbinden.'
        )}`
      );
      return;
    }

    await kundenIntegrationSpeichern(
      kundeId,
      'google',
      {
        client_id: clientId,
        client_geheimnis: clientGeheimnis,
        refresh_token: tokens.refresh_token,
        kalender_id: 'primary',
      },
      true,
    );

    logger.info(`Google Calendar OAuth erfolgreich für Kunde ${kundeId}`);
    res.redirect(`${frontendUrl}/kunden/${kundeId}?google_calendar=verbunden`);
  } catch (fehler) {
    logger.error('Google OAuth Callback fehlgeschlagen:', { error: fehler });
    next(fehler);
  }
});

// ──────────────────────────────────────────────
// Outlook Callback
// ──────────────────────────────────────────────
oauthRouter.get('/outlook/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (error) {
      logger.warn(`Outlook OAuth abgelehnt: ${String(error)}`);
      res.redirect(`${frontendUrl}/kunden?outlook_calendar=fehler&grund=${encodeURIComponent(String(error))}`);
      return;
    }

    const kundeId = kundeIdAusState(state);
    if (!kundeId) {
      res.status(400).send('Ungültiger oder fehlender state-Parameter.');
      return;
    }

    if (!code || typeof code !== 'string') {
      res.status(400).send('Authorization Code fehlt.');
      return;
    }

    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientGeheimnis = process.env.OUTLOOK_CLIENT_GEHEIMNIS;
    const tenantId = process.env.OUTLOOK_TENANT_ID || 'common';
    if (!clientId || !clientGeheimnis) {
      res.status(500).send('Outlook OAuth nicht konfiguriert (OUTLOOK_CLIENT_ID / OUTLOOK_CLIENT_GEHEIMNIS fehlen).');
      return;
    }

    const tokenAntwort = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientGeheimnis,
          code,
          redirect_uri: outlookRedirectUri(),
          grant_type: 'authorization_code',
          scope: 'offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite',
        }),
      }
    );

    if (!tokenAntwort.ok) {
      const fehlerText = await tokenAntwort.text();
      logger.error('Outlook Token-Tausch fehlgeschlagen:', { fehlerText });
      res.redirect(
        `${frontendUrl}/kunden/${kundeId}?outlook_calendar=fehler&grund=${encodeURIComponent('Token-Tausch fehlgeschlagen')}`
      );
      return;
    }

    const tokens = (await tokenAntwort.json()) as { refresh_token?: string };

    if (!tokens.refresh_token) {
      res.redirect(
        `${frontendUrl}/kunden/${kundeId}?outlook_calendar=fehler&grund=${encodeURIComponent('Kein Refresh-Token erhalten')}`
      );
      return;
    }

    await kundenIntegrationSpeichern(
      kundeId,
      'outlook',
      {
        client_id: clientId,
        client_geheimnis: clientGeheimnis,
        tenant_id: tenantId,
        refresh_token: tokens.refresh_token,
      },
      true,
    );

    logger.info(`Outlook Calendar OAuth erfolgreich für Kunde ${kundeId}`);
    res.redirect(`${frontendUrl}/kunden/${kundeId}?outlook_calendar=verbunden`);
  } catch (fehler) {
    logger.error('Outlook OAuth Callback fehlgeschlagen:', { error: fehler });
    next(fehler);
  }
});
