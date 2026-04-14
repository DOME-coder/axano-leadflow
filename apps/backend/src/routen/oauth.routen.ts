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

// Hilfsfunktion: Statische Redirect-URI für Facebook
export function facebookRedirectUri(): string {
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
  return `${apiBaseUrl}/api/v1/oauth/facebook/callback`;
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

// ──────────────────────────────────────────────
// Facebook Callback
// ──────────────────────────────────────────────
oauthRouter.get('/facebook/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state, error, error_reason } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (error) {
      logger.warn(`Facebook OAuth abgelehnt: ${String(error)} (${String(error_reason || '')})`);
      res.redirect(`${frontendUrl}/kunden?facebook_lead_ads=fehler&grund=${encodeURIComponent(String(error_reason || error))}`);
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

    const appId = process.env.FACEBOOK_APP_ID;
    const appGeheimnis = process.env.FACEBOOK_APP_GEHEIMNIS;
    if (!appId || !appGeheimnis) {
      res.status(500).send('Facebook OAuth nicht konfiguriert (FACEBOOK_APP_ID / FACEBOOK_APP_GEHEIMNIS fehlen).');
      return;
    }

    // Schritt 1: Code gegen User-Access-Token tauschen
    const tokenAntwort = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
        client_id: appId,
        client_secret: appGeheimnis,
        redirect_uri: facebookRedirectUri(),
        code,
      })}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!tokenAntwort.ok) {
      const fehlerText = await tokenAntwort.text();
      logger.error('Facebook Token-Tausch fehlgeschlagen:', { fehlerText });
      res.redirect(`${frontendUrl}/kunden/${kundeId}?facebook_lead_ads=fehler&grund=${encodeURIComponent('Token-Tausch fehlgeschlagen')}`);
      return;
    }

    const tokenDaten = (await tokenAntwort.json()) as { access_token: string };
    const userToken = tokenDaten.access_token;
    logger.info('Facebook OAuth: User-Token erhalten, pruefe Permissions...');

    // Debug: Token-Permissions pruefen
    try {
      const debugAntwort = await fetch(
        `https://graph.facebook.com/v18.0/me/permissions?access_token=${userToken}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (debugAntwort.ok) {
        const perms = await debugAntwort.json();
        logger.info('Facebook OAuth: Token-Permissions:', { permissions: JSON.stringify(perms) });
      }
    } catch { /* nur Diagnose, kein Abbruch */ }

    // Schritt 2: Seiten des Users abrufen (mit Page-Access-Tokens)
    const seitenAntwort = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${userToken}&fields=id,name,access_token`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!seitenAntwort.ok) {
      const seitenFehler = await seitenAntwort.text();
      logger.error('Facebook Seiten-Abruf fehlgeschlagen:', { status: seitenAntwort.status, body: seitenFehler });
      res.redirect(`${frontendUrl}/kunden/${kundeId}?facebook_lead_ads=fehler&grund=${encodeURIComponent('Seiten konnten nicht abgerufen werden')}`);
      return;
    }

    const seitenRoh = await seitenAntwort.json();
    logger.info('Facebook /me/accounts Antwort:', { antwort: JSON.stringify(seitenRoh).substring(0, 500) });

    const seitenDaten = seitenRoh as {
      data: Array<{ id: string; name: string; access_token: string }>;
    };

    if (!seitenDaten.data?.length) {
      logger.warn('Facebook OAuth: Keine Seiten in /me/accounts — vollstaendige Antwort:', { antwort: JSON.stringify(seitenRoh) });
      res.redirect(`${frontendUrl}/kunden/${kundeId}?facebook_lead_ads=fehler&grund=${encodeURIComponent('Keine Facebook-Seiten gefunden. Bitte Berechtigungen pruefen.')}`);
      return;
    }

    // Option A: Erste Seite automatisch nehmen
    const seite = seitenDaten.data[0];
    logger.info(`Facebook OAuth: Seite "${seite.name}" (ID: ${seite.id}) ausgewaehlt fuer Kunde ${kundeId}`);

    // Schritt 3: Page-Token langlebig machen (60 Tage)
    let langLebigerPageToken = seite.access_token;
    try {
      const llAntwort = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?${new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appGeheimnis,
          fb_exchange_token: seite.access_token,
        })}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (llAntwort.ok) {
        const llDaten = (await llAntwort.json()) as { access_token: string };
        langLebigerPageToken = llDaten.access_token;
        logger.info(`Facebook: Page-Token fuer "${seite.name}" auf langlebig umgetauscht`);
      } else {
        logger.warn('Facebook: Langlebiger Token-Tausch fehlgeschlagen — verwende kurzlebigen Token');
      }
    } catch {
      logger.warn('Facebook: Langlebiger Token-Tausch Timeout — verwende kurzlebigen Token');
    }

    // Schritt 4: Webhook fuer leadgen auf der Seite registrieren
    try {
      const webhookAntwort = await fetch(
        `https://graph.facebook.com/v18.0/${seite.id}/subscribed_apps`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: langLebigerPageToken,
            subscribed_fields: ['leadgen'],
          }),
          signal: AbortSignal.timeout(10000),
        }
      );
      if (webhookAntwort.ok) {
        logger.info(`Facebook: Webhook fuer leadgen auf Seite "${seite.name}" registriert`);
      } else {
        const webhookFehler = await webhookAntwort.text();
        logger.warn(`Facebook: Webhook-Registrierung fehlgeschlagen: ${webhookFehler}`);
      }
    } catch (webhookErr) {
      logger.warn('Facebook: Webhook-Registrierung Timeout', { error: webhookErr });
    }

    // Schritt 5: Alles in KundenIntegration speichern
    await kundenIntegrationSpeichern(
      kundeId,
      'facebook',
      {
        app_id: appId,
        app_geheimnis: appGeheimnis,
        verify_token: process.env.FACEBOOK_VERIFY_TOKEN || '',
        seiten_zugriffstoken: langLebigerPageToken,
        page_id: seite.id,
        page_name: seite.name,
        page_access_token: langLebigerPageToken,
      },
      true,
    );

    logger.info(`Facebook Lead Ads OAuth erfolgreich fuer Kunde ${kundeId} (Seite: ${seite.name})`);
    res.redirect(`${frontendUrl}/kunden/${kundeId}?facebook_lead_ads=verbunden`);
  } catch (fehler) {
    logger.error('Facebook OAuth Callback fehlgeschlagen:', { error: fehler });
    next(fehler);
  }
});
