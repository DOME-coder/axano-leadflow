import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { google } from 'googleapis';
import { authentifizierung, nurAdmin } from '../middleware/authentifizierung';
import {
  kundenIntegrationenAuflisten,
  kundenIntegrationSpeichern,
  kundenIntegrationLoeschen,
} from '../dienste/integrationen.dienst';
import { logger } from '../hilfsfunktionen/logger';

export const kundenIntegrationenRouter = Router({ mergeParams: true });
kundenIntegrationenRouter.use(authentifizierung);
kundenIntegrationenRouter.use(nurAdmin);

// GET /api/v1/kunden/:kundeId/integrationen
kundenIntegrationenRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const integrationen = await kundenIntegrationenAuflisten(req.params.kundeId);
    res.json({ erfolg: true, daten: integrationen });
  } catch (fehler) {
    next(fehler);
  }
});

const speichernSchema = z.object({
  konfiguration: z.record(z.string()),
  aktiv: z.boolean(),
});

// PATCH /api/v1/kunden/:kundeId/integrationen/:name
kundenIntegrationenRouter.patch('/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { konfiguration, aktiv } = speichernSchema.parse(req.body);
    const integration = await kundenIntegrationSpeichern(
      req.params.kundeId,
      req.params.name,
      konfiguration,
      aktiv
    );
    logger.info(`Kunden-Integration ${req.params.name} für ${req.params.kundeId} aktualisiert von ${req.benutzer?.email}`);
    res.json({ erfolg: true, daten: integration });
  } catch (fehler) {
    next(fehler);
  }
});

// DELETE /api/v1/kunden/:kundeId/integrationen/:name
kundenIntegrationenRouter.delete('/:name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await kundenIntegrationLoeschen(req.params.kundeId, req.params.name);
    res.json({ erfolg: true, nachricht: `Integration "${req.params.name}" zurückgesetzt auf globale Einstellung.` });
  } catch (fehler) {
    next(fehler);
  }
});

// ──────────────────────────────────────────────
// Google Calendar OAuth Flow
// ──────────────────────────────────────────────

// GET /api/v1/kunden/:kundeId/integrationen/google/oauth-url
kundenIntegrationenRouter.get('/google/oauth-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientGeheimnis = process.env.GOOGLE_CLIENT_GEHEIMNIS;
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';

    if (!clientId || !clientGeheimnis) {
      res.status(400).json({
        erfolg: false,
        fehler: 'Google OAuth ist nicht konfiguriert. Bitte GOOGLE_CLIENT_ID und GOOGLE_CLIENT_GEHEIMNIS als Umgebungsvariablen setzen.',
      });
      return;
    }

    const redirectUri = `${apiBaseUrl}/api/v1/kunden/${req.params.kundeId}/integrationen/google/oauth-callback`;

    const oauth2Client = new google.auth.OAuth2(clientId, clientGeheimnis, redirectUri);

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      state: req.params.kundeId,
    });

    res.json({ erfolg: true, daten: { url } });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/kunden/:kundeId/integrationen/google/oauth-callback
kundenIntegrationenRouter.get('/google/oauth-callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.query;
    const kundeId = req.params.kundeId;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientGeheimnis = process.env.GOOGLE_CLIENT_GEHEIMNIS;
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (!code || typeof code !== 'string') {
      res.status(400).json({ erfolg: false, fehler: 'Authorization Code fehlt.' });
      return;
    }

    if (!clientId || !clientGeheimnis) {
      res.status(400).json({ erfolg: false, fehler: 'Google OAuth nicht konfiguriert.' });
      return;
    }

    const redirectUri = `${apiBaseUrl}/api/v1/kunden/${kundeId}/integrationen/google/oauth-callback`;
    const oauth2Client = new google.auth.OAuth2(clientId, clientGeheimnis, redirectUri);

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      res.status(400).json({
        erfolg: false,
        fehler: 'Kein Refresh-Token erhalten. Bitte die Google-App-Berechtigung widerrufen und erneut verbinden.',
      });
      return;
    }

    // Kunden-Integration speichern
    await kundenIntegrationSpeichern(kundeId, 'google', {
      client_id: clientId,
      client_geheimnis: clientGeheimnis,
      refresh_token: tokens.refresh_token,
      kalender_id: 'primary',
    }, true);

    logger.info(`Google Calendar OAuth erfolgreich für Kunde ${kundeId}`);

    // Redirect zurück zum Frontend
    res.redirect(`${frontendUrl}/kunden/${kundeId}?google_calendar=verbunden`);
  } catch (fehler) {
    logger.error('Google OAuth Callback fehlgeschlagen:', { error: fehler });
    next(fehler);
  }
});

// ──────────────────────────────────────────────
// Outlook Calendar OAuth Flow
// ──────────────────────────────────────────────

// GET /api/v1/kunden/:kundeId/integrationen/outlook/oauth-url
kundenIntegrationenRouter.get('/outlook/oauth-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const tenantId = process.env.OUTLOOK_TENANT_ID || 'common';
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';

    if (!clientId) {
      res.status(400).json({
        erfolg: false,
        fehler: 'Outlook OAuth ist nicht konfiguriert. Bitte OUTLOOK_CLIENT_ID als Umgebungsvariable setzen.',
      });
      return;
    }

    const redirectUri = `${apiBaseUrl}/api/v1/kunden/${req.params.kundeId}/integrationen/outlook/oauth-callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite',
      state: req.params.kundeId,
      prompt: 'consent',
    });

    const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;

    res.json({ erfolg: true, daten: { url } });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/kunden/:kundeId/integrationen/outlook/oauth-callback
kundenIntegrationenRouter.get('/outlook/oauth-callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.query;
    const kundeId = req.params.kundeId;
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const clientGeheimnis = process.env.OUTLOOK_CLIENT_GEHEIMNIS;
    const tenantId = process.env.OUTLOOK_TENANT_ID || 'common';
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

    if (!code || typeof code !== 'string' || !clientId || !clientGeheimnis) {
      res.status(400).json({ erfolg: false, fehler: 'Authorization Code oder Konfiguration fehlt.' });
      return;
    }

    const redirectUri = `${apiBaseUrl}/api/v1/kunden/${kundeId}/integrationen/outlook/oauth-callback`;

    // Token tauschen
    const tokenAntwort = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientGeheimnis,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          scope: 'offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite',
        }),
      }
    );

    if (!tokenAntwort.ok) {
      const fehler = await tokenAntwort.text();
      logger.error('Outlook Token-Tausch fehlgeschlagen:', { fehler });
      res.status(400).json({ erfolg: false, fehler: 'Outlook Token-Tausch fehlgeschlagen.' });
      return;
    }

    const tokens = await tokenAntwort.json() as { refresh_token?: string };

    if (!tokens.refresh_token) {
      res.status(400).json({
        erfolg: false,
        fehler: 'Kein Refresh-Token erhalten. Bitte erneut verbinden.',
      });
      return;
    }

    // Kunden-Integration speichern
    await kundenIntegrationSpeichern(kundeId, 'outlook', {
      client_id: clientId,
      client_geheimnis: clientGeheimnis,
      tenant_id: tenantId,
      refresh_token: tokens.refresh_token,
    }, true);

    logger.info(`Outlook Calendar OAuth erfolgreich für Kunde ${kundeId}`);

    res.redirect(`${frontendUrl}/kunden/${kundeId}?outlook_calendar=verbunden`);
  } catch (fehler) {
    logger.error('Outlook OAuth Callback fehlgeschlagen:', { error: fehler });
    next(fehler);
  }
});
