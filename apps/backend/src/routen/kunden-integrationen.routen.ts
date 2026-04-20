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

// ──────────────────────────────────────────────
// Facebook-Diagnose (prueft Verbindung, Seiten, Berechtigungen, Formulare)
// ──────────────────────────────────────────────

// GET /api/v1/kunden/:kundeId/integrationen/facebook/diagnose
kundenIntegrationenRouter.get('/facebook/diagnose', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fbKonfig = await import('../dienste/integrationen.dienst').then(
      (m) => m.integrationKonfigurationLesenMitFallback('facebook', req.params.kundeId)
    );

    interface DiagnoseSeite {
      id: string;
      name: string;
      istVerbunden: boolean;
      quelle: 'persoenlich' | 'business-owned' | 'business-client';
      businessName?: string;
      formAnzahl?: number;
      formFehler?: string;
    }

    interface DiagnoseFormular {
      id: string;
      name: string;
      status: string;
      seiteId: string;
      seiteName: string;
      felderAnzahl: number;
    }

    const befund = {
      verbunden: false,
      verbindungsFehler: null as string | null,
      verbundeneSeite: null as { id: string; name: string } | null,
      erteilteBerechtigungen: [] as string[],
      fehlendeBerechtigungen: [] as string[],
      alleSeiten: [] as DiagnoseSeite[],
      formulare: [] as DiagnoseFormular[],
      empfehlungen: [] as string[],
    };

    if (!fbKonfig?.page_access_token || !fbKonfig?.page_id) {
      befund.verbindungsFehler = 'Facebook ist fuer diesen Kunden nicht verbunden.';
      befund.empfehlungen.push('Klicke auf "Mit Facebook verbinden" in der Kunden-Integration.');
      res.json({ erfolg: true, daten: befund });
      return;
    }

    befund.verbunden = true;
    befund.verbundeneSeite = {
      id: fbKonfig.page_id,
      name: fbKonfig.page_name || '(Name unbekannt)',
    };

    const benoetigteBerechtigungen = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
      'leads_retrieval',
      'business_management',
    ];

    // 1. Berechtigungen pruefen (ueber User-Token falls vorhanden, sonst Page-Token)
    const userToken = fbKonfig.seiten_zugriffstoken || fbKonfig.page_access_token;
    try {
      const berechtigungsAntwort = await fetch(
        `https://graph.facebook.com/v18.0/me/permissions?access_token=${userToken}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (berechtigungsAntwort.ok) {
        const permsJson = await berechtigungsAntwort.json() as {
          data?: Array<{ permission: string; status: string }>;
        };
        const erteilt = (permsJson.data || [])
          .filter((p) => p.status === 'granted')
          .map((p) => p.permission);
        befund.erteilteBerechtigungen = erteilt;
        befund.fehlendeBerechtigungen = benoetigteBerechtigungen.filter((b) => !erteilt.includes(b));
      }
    } catch (fehler) {
      logger.warn('Facebook Berechtigungen konnten nicht abgerufen werden', { error: fehler });
    }

    if (befund.fehlendeBerechtigungen.length > 0) {
      befund.empfehlungen.push(
        `Fehlende Berechtigung(en): ${befund.fehlendeBerechtigungen.join(', ')}. Bitte Facebook fuer diesen Kunden neu verbinden und im Dialog alle Haeckchen setzen.`
      );
    }

    // 2. Seiten aus DREI Quellen sammeln (persoenlich, Business-owned, Business-client)
    interface GefundeneSeite {
      id: string;
      name: string;
      access_token?: string;
      quelle: 'persoenlich' | 'business-owned' | 'business-client';
      businessName?: string;
    }
    const seitenSammlung = new Map<string, GefundeneSeite>();

    // 2a. Persoenliche Seiten
    try {
      const antwort = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?access_token=${userToken}&fields=id,name,access_token&limit=100`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (antwort.ok) {
        const json = await antwort.json() as { data?: Array<{ id: string; name: string; access_token?: string }> };
        for (const seite of json.data || []) {
          if (!seitenSammlung.has(seite.id)) {
            seitenSammlung.set(seite.id, { ...seite, quelle: 'persoenlich' });
          }
        }
      }
    } catch (fehler) {
      logger.warn('Facebook /me/accounts fehlgeschlagen', { error: fehler });
    }

    // 2b. Business-Manager: eigene Seiten + Client-Seiten
    try {
      const bizAntwort = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?access_token=${userToken}&fields=id,name&limit=50`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (bizAntwort.ok) {
        const bizJson = await bizAntwort.json() as { data?: Array<{ id: string; name: string }> };
        const businesses = bizJson.data || [];

        for (const biz of businesses) {
          // owned_pages (Business besitzt die Seite selbst)
          try {
            const ownedAntwort = await fetch(
              `https://graph.facebook.com/v18.0/${biz.id}/owned_pages?access_token=${userToken}&fields=id,name,access_token&limit=100`,
              { signal: AbortSignal.timeout(10000) }
            );
            if (ownedAntwort.ok) {
              const json = await ownedAntwort.json() as { data?: Array<{ id: string; name: string; access_token?: string }> };
              for (const seite of json.data || []) {
                if (!seitenSammlung.has(seite.id)) {
                  seitenSammlung.set(seite.id, { ...seite, quelle: 'business-owned', businessName: biz.name });
                }
              }
            }
          } catch (fehler) {
            logger.warn(`Facebook owned_pages fuer Business ${biz.id} fehlgeschlagen`, { error: fehler });
          }

          // client_pages (Kundenseiten, die das Business verwaltet – typisch fuer Agenturen)
          try {
            const clientAntwort = await fetch(
              `https://graph.facebook.com/v18.0/${biz.id}/client_pages?access_token=${userToken}&fields=id,name,access_token&limit=100`,
              { signal: AbortSignal.timeout(10000) }
            );
            if (clientAntwort.ok) {
              const json = await clientAntwort.json() as { data?: Array<{ id: string; name: string; access_token?: string }> };
              for (const seite of json.data || []) {
                if (!seitenSammlung.has(seite.id)) {
                  seitenSammlung.set(seite.id, { ...seite, quelle: 'business-client', businessName: biz.name });
                }
              }
            }
          } catch (fehler) {
            logger.warn(`Facebook client_pages fuer Business ${biz.id} fehlgeschlagen`, { error: fehler });
          }
        }
      }
    } catch (fehler) {
      logger.warn('Facebook /me/businesses fehlgeschlagen', { error: fehler });
    }

    // 2c. Fallback: verbundene Seite ist in keiner Liste (z. B. weil Scope fehlt) → trotzdem aufnehmen
    if (!seitenSammlung.has(fbKonfig.page_id)) {
      seitenSammlung.set(fbKonfig.page_id, {
        id: fbKonfig.page_id,
        name: fbKonfig.page_name || '(verbundene Seite)',
        access_token: fbKonfig.page_access_token,
        quelle: 'persoenlich',
      });
    }

    // 3. Fuer jede gefundene Seite Formulare abrufen
    for (const seite of seitenSammlung.values()) {
      const seiteBefund: DiagnoseSeite = {
        id: seite.id,
        name: seite.name,
        istVerbunden: seite.id === fbKonfig.page_id,
        quelle: seite.quelle,
        businessName: seite.businessName,
      };

      // Page-Token besorgen: aus Sammlung oder explizit anfragen (fuer Business-Seiten ohne Token)
      let pageToken = seite.access_token;
      if (!pageToken && seite.id === fbKonfig.page_id) {
        pageToken = fbKonfig.page_access_token;
      }
      if (!pageToken) {
        try {
          const tokenAntwort = await fetch(
            `https://graph.facebook.com/v18.0/${seite.id}?fields=access_token&access_token=${userToken}`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (tokenAntwort.ok) {
            const j = await tokenAntwort.json() as { access_token?: string };
            pageToken = j.access_token;
          }
        } catch { /* weiter */ }
      }

      const formsToken = pageToken || userToken;

      try {
        const formsAntwort = await fetch(
          `https://graph.facebook.com/v18.0/${seite.id}/leadgen_forms?access_token=${formsToken}&fields=id,name,status,created_time,questions&limit=100`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (formsAntwort.ok) {
          const formsJson = await formsAntwort.json() as {
            data?: Array<{ id: string; name: string; status: string; questions?: Array<{ key: string }> }>;
          };
          const forms = formsJson.data || [];
          seiteBefund.formAnzahl = forms.length;

          for (const form of forms) {
            befund.formulare.push({
              id: form.id,
              name: form.name,
              status: form.status,
              seiteId: seite.id,
              seiteName: seite.name,
              felderAnzahl: form.questions?.length || 0,
            });
          }
        } else {
          const fehlerText = await formsAntwort.text();
          try {
            const fbJson = JSON.parse(fehlerText) as { error?: { message?: string } };
            seiteBefund.formFehler = fbJson.error?.message || 'Unbekannter Fehler';
          } catch {
            seiteBefund.formFehler = `HTTP ${formsAntwort.status}`;
          }
        }
      } catch (fehler) {
        seiteBefund.formFehler = fehler instanceof Error ? fehler.message : 'Netzwerkfehler';
      }

      befund.alleSeiten.push(seiteBefund);
    }

    // 3. Empfehlungen ableiten
    const formulareAufVerbundenerSeite = befund.formulare.filter((f) => f.seiteId === fbKonfig.page_id);
    const formulareAufAnderenSeiten = befund.formulare.filter((f) => f.seiteId !== fbKonfig.page_id);

    if (formulareAufVerbundenerSeite.length === 0) {
      if (formulareAufAnderenSeiten.length > 0) {
        const andereSeiten = [...new Set(formulareAufAnderenSeiten.map((f) => f.seiteName))].join(', ');
        befund.empfehlungen.push(
          `Es gibt ${formulareAufAnderenSeiten.length} Formular(e), aber auf anderen Seiten: ${andereSeiten}. Die verbundene Seite "${befund.verbundeneSeite.name}" hat keine Formulare. Bitte Facebook neu verbinden und die richtige Seite waehlen — oder Formular auf der richtigen Seite erstellen.`
        );
      } else {
        befund.empfehlungen.push(
          `Keine Lead-Formulare auf irgendeiner Seite des Kunden gefunden. Bitte bei Meta Business Suite ein Instant Form erstellen und als "Veroeffentlicht" speichern.`
        );
      }
    } else {
      befund.empfehlungen.push(
        `Alles in Ordnung: ${formulareAufVerbundenerSeite.length} Formular(e) auf der verbundenen Seite "${befund.verbundeneSeite.name}".`
      );
    }

    res.json({ erfolg: true, daten: befund });
  } catch (fehler) {
    next(fehler);
  }
});
