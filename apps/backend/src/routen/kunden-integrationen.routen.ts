import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { google } from 'googleapis';
import { authentifizierung, nurAdmin } from '../middleware/authentifizierung';
import {
  kundenIntegrationenAuflisten,
  kundenIntegrationSpeichern,
  kundenIntegrationLoeschen,
} from '../dienste/integrationen.dienst';
import { googleRedirectUri, outlookRedirectUri } from './oauth.routen';
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
// Google Calendar OAuth Flow (URL-Generator)
// Callback liegt unter /api/v1/oauth/google/callback (statisch)
// ──────────────────────────────────────────────

// GET /api/v1/kunden/:kundeId/integrationen/google/oauth-url
kundenIntegrationenRouter.get('/google/oauth-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientGeheimnis = process.env.GOOGLE_CLIENT_GEHEIMNIS;

    if (!clientId || !clientGeheimnis) {
      res.status(400).json({
        erfolg: false,
        fehler: 'Google OAuth ist nicht konfiguriert. Bitte GOOGLE_CLIENT_ID und GOOGLE_CLIENT_GEHEIMNIS als Umgebungsvariablen setzen.',
      });
      return;
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientGeheimnis, googleRedirectUri());

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      // kundeId fließt im state-Parameter; der Callback liest ihn dort wieder aus
      state: req.params.kundeId,
    });

    res.json({ erfolg: true, daten: { url } });
  } catch (fehler) {
    next(fehler);
  }
});

// ──────────────────────────────────────────────
// Outlook Calendar OAuth Flow (URL-Generator)
// Callback liegt unter /api/v1/oauth/outlook/callback (statisch)
// ──────────────────────────────────────────────

// GET /api/v1/kunden/:kundeId/integrationen/outlook/oauth-url
kundenIntegrationenRouter.get('/outlook/oauth-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientId = process.env.OUTLOOK_CLIENT_ID;
    const tenantId = process.env.OUTLOOK_TENANT_ID || 'common';

    if (!clientId) {
      res.status(400).json({
        erfolg: false,
        fehler: 'Outlook OAuth ist nicht konfiguriert. Bitte OUTLOOK_CLIENT_ID als Umgebungsvariable setzen.',
      });
      return;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: outlookRedirectUri(),
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
