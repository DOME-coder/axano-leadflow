import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { google } from 'googleapis';
import { authentifizierung, nurAdmin } from '../middleware/authentifizierung';
import {
  kundenIntegrationenAuflisten,
  kundenIntegrationSpeichern,
  kundenIntegrationLoeschen,
} from '../dienste/integrationen.dienst';
import { googleRedirectUri, outlookRedirectUri, facebookRedirectUri } from './oauth.routen';
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

// ──────────────────────────────────────────────
// Facebook Lead Ads OAuth Flow (URL-Generator)
// Callback liegt unter /api/v1/oauth/facebook/callback (statisch)
// ──────────────────────────────────────────────

// GET /api/v1/kunden/:kundeId/integrationen/facebook/oauth-url
kundenIntegrationenRouter.get('/facebook/oauth-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appId = process.env.FACEBOOK_APP_ID;

    if (!appId) {
      res.status(400).json({
        erfolg: false,
        fehler: 'Facebook OAuth ist nicht konfiguriert. Bitte FACEBOOK_APP_ID als Umgebungsvariable setzen.',
      });
      return;
    }

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: facebookRedirectUri(),
      scope: 'business_management,pages_manage_metadata,pages_read_engagement,leads_retrieval,pages_show_list',
      response_type: 'code',
      state: req.params.kundeId,
    });

    const url = `https://www.facebook.com/v18.0/dialog/oauth?${params}`;

    res.json({ erfolg: true, daten: { url } });
  } catch (fehler) {
    next(fehler);
  }
});

// ──────────────────────────────────────────────
// Facebook Lead Forms abrufen (pro Kunde)
// ──────────────────────────────────────────────

// GET /api/v1/kunden/:kundeId/integrationen/facebook/forms
kundenIntegrationenRouter.get('/facebook/forms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fbKonfig = await import('../dienste/integrationen.dienst').then(
      (m) => m.integrationKonfigurationLesenMitFallback('facebook', req.params.kundeId)
    );

    if (!fbKonfig?.page_access_token || !fbKonfig?.page_id) {
      res.status(400).json({
        erfolg: false,
        fehler: 'Facebook ist für diesen Kunden nicht verbunden. Bitte zuerst "Mit Facebook verbinden".',
      });
      return;
    }

    const formsAntwort = await fetch(
      `https://graph.facebook.com/v18.0/${fbKonfig.page_id}/leadgen_forms?access_token=${fbKonfig.page_access_token}&fields=id,name,status,questions,created_time&limit=50`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!formsAntwort.ok) {
      const fehlerText = await formsAntwort.text();
      logger.error('Facebook Forms-Abruf fehlgeschlagen:', { status: formsAntwort.status, body: fehlerText.substring(0, 500), pageId: fbKonfig.page_id });

      // Facebook-Fehlermeldung extrahieren und durchreichen
      let fbFehler = 'Facebook-Formulare konnten nicht abgerufen werden.';
      try {
        const fbJson = JSON.parse(fehlerText) as { error?: { message?: string; code?: number } };
        if (fbJson.error?.message) {
          fbFehler = `Facebook-Fehler: ${fbJson.error.message}`;
        }
      } catch { /* kein JSON */ }

      res.status(400).json({ erfolg: false, fehler: fbFehler });
      return;
    }

    const formsDaten = await formsAntwort.json() as {
      data?: Array<{
        id: string;
        name: string;
        status: string;
        created_time?: string;
        questions?: Array<{
          key: string;
          label: string;
          type: string;
          options?: Array<{ key: string; value: string }>;
        }>;
      }>;
    };

    // Standard-Facebook-Felder die automatisch gemappt werden
    const standardFelder = new Set(['first_name', 'last_name', 'email', 'phone_number', 'full_name', 'city', 'state', 'zip_code', 'country']);

    const forms = (formsDaten.data || []).map((form) => ({
      id: form.id,
      name: form.name,
      status: form.status,
      erstelltAm: form.created_time,
      felder: (form.questions || []).map((q) => ({
        key: q.key,
        label: q.label,
        typ: q.type,
        istStandard: standardFelder.has(q.key),
        optionen: q.options?.map((o) => o.value) || [],
      })),
    }));

    res.json({ erfolg: true, daten: forms });
  } catch (fehler) {
    next(fehler);
  }
});
