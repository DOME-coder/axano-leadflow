import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { google } from 'googleapis';
import { authentifizierung, nurAdmin } from '../middleware/authentifizierung';
import {
  kundenIntegrationenAuflisten,
  kundenIntegrationSpeichern,
  kundenIntegrationLoeschen,
} from '../dienste/integrationen.dienst';
import { googleRedirectUri, outlookRedirectUri, facebookRedirectUri, whatsappRedirectUri } from './oauth.routen';
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
      scope: 'business_management,pages_manage_metadata,pages_read_engagement,leads_retrieval,pages_show_list,pages_manage_ads',
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
      'pages_manage_ads',
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

    // Spezifische Fehler-Erkennung: wenn ueberall "pages_manage_ads" Fehler → Permission fehlt
    const alleSeitenFehlerPagesManageAds = befund.alleSeiten.length > 0 &&
      befund.alleSeiten.every((s) => s.formFehler?.toLowerCase().includes('pages_manage_ads'));

    if (alleSeitenFehlerPagesManageAds) {
      befund.empfehlungen.push(
        'Meta verlangt die Berechtigung "pages_manage_ads" um Lead-Formulare abzurufen. Bitte Facebook fuer diesen Kunden EINMAL neu verbinden — im OAuth-Dialog muss die zusaetzliche Berechtigung akzeptiert werden. Dieser Schritt ist nur einmal noetig.'
      );
    } else if (formulareAufVerbundenerSeite.length === 0) {
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

// ──────────────────────────────────────────────
// WhatsApp Business (Meta) – OAuth-URL, Phone Numbers, Templates, Diagnose
// ──────────────────────────────────────────────

// GET /api/v1/kunden/:kundeId/integrationen/whatsapp/oauth-url
kundenIntegrationenRouter.get('/whatsapp/oauth-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appId = process.env.FACEBOOK_APP_ID;
    if (!appId) {
      res.status(500).json({ erfolg: false, fehler: 'FACEBOOK_APP_ID nicht konfiguriert.' });
      return;
    }

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: whatsappRedirectUri(),
      scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management',
      response_type: 'code',
      state: req.params.kundeId,
    });

    const url = `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
    res.json({ erfolg: true, daten: { url } });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/kunden/:kundeId/integrationen/whatsapp/phone-numbers
kundenIntegrationenRouter.get('/whatsapp/phone-numbers', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { integrationKonfigurationLesenMitFallback } = await import('../dienste/integrationen.dienst');
    const konfig = await integrationKonfigurationLesenMitFallback('whatsapp', req.params.kundeId);

    if (!konfig?.zugriffstoken) {
      res.status(400).json({ erfolg: false, fehler: 'WhatsApp ist fuer diesen Kunden nicht verbunden.' });
      return;
    }

    const { metaWabaListeAbrufen, metaPhoneNumbersAbrufen } = await import('../dienste/whatsapp-meta.dienst');
    const wabas = await metaWabaListeAbrufen(konfig.zugriffstoken);

    interface PhoneNumberAusgabe {
      wabaId: string;
      wabaName: string;
      id: string;
      displayPhoneNumber: string;
      verifiedName: string;
      qualityRating?: string;
    }
    const alle: PhoneNumberAusgabe[] = [];

    for (const waba of wabas) {
      const nummern = await metaPhoneNumbersAbrufen(waba.id, konfig.zugriffstoken);
      for (const n of nummern) {
        alle.push({
          wabaId: waba.id,
          wabaName: waba.name,
          id: n.id,
          displayPhoneNumber: n.display_phone_number,
          verifiedName: n.verified_name,
          qualityRating: n.quality_rating,
        });
      }
    }

    res.json({ erfolg: true, daten: alle });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/kunden/:kundeId/integrationen/whatsapp/templates?wabaId=xxx
kundenIntegrationenRouter.get('/whatsapp/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { integrationKonfigurationLesenMitFallback } = await import('../dienste/integrationen.dienst');
    const konfig = await integrationKonfigurationLesenMitFallback('whatsapp', req.params.kundeId);

    if (!konfig?.zugriffstoken) {
      res.status(400).json({ erfolg: false, fehler: 'WhatsApp ist fuer diesen Kunden nicht verbunden.' });
      return;
    }

    const wabaId = typeof req.query.wabaId === 'string' ? req.query.wabaId : konfig.waba_id;
    if (!wabaId) {
      res.status(400).json({ erfolg: false, fehler: 'Keine WABA-ID verfuegbar. Bitte zuerst verbinden.' });
      return;
    }

    const { metaTemplatesAbrufen } = await import('../dienste/whatsapp-meta.dienst');
    const templates = await metaTemplatesAbrufen(wabaId, konfig.zugriffstoken);

    res.json({ erfolg: true, daten: templates });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/kunden/:kundeId/integrationen/whatsapp/diagnose
kundenIntegrationenRouter.get('/whatsapp/diagnose', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { integrationKonfigurationLesenMitFallback } = await import('../dienste/integrationen.dienst');
    const konfig = await integrationKonfigurationLesenMitFallback('whatsapp', req.params.kundeId);

    interface DiagnoseWaba {
      id: string;
      name: string;
      istVerbunden: boolean;
      phoneNumbers: Array<{
        id: string;
        displayPhoneNumber: string;
        verifiedName: string;
        qualityRating?: string;
      }>;
      templateAnzahl?: number;
      templateGenehmigt?: number;
    }

    const befund = {
      verbunden: false,
      verbindungsFehler: null as string | null,
      verbundeneWaba: null as { id: string; name: string } | null,
      verbundenePhoneNumber: null as { id: string; display: string } | null,
      erteilteBerechtigungen: [] as string[],
      fehlendeBerechtigungen: [] as string[],
      wabas: [] as DiagnoseWaba[],
      empfehlungen: [] as string[],
    };

    if (!konfig?.zugriffstoken) {
      befund.verbindungsFehler = 'WhatsApp ist fuer diesen Kunden nicht verbunden.';
      befund.empfehlungen.push('Klicke auf "Mit WhatsApp verbinden" in der Kunden-Integration.');
      res.json({ erfolg: true, daten: befund });
      return;
    }

    befund.verbunden = true;
    if (konfig.waba_id) {
      befund.verbundeneWaba = { id: konfig.waba_id, name: konfig.waba_name || '(unbekannt)' };
    }
    if (konfig.phone_number_id) {
      befund.verbundenePhoneNumber = {
        id: konfig.phone_number_id,
        display: konfig.phone_number_display || '(unbekannt)',
      };
    }

    const benoetigt = [
      'whatsapp_business_management',
      'whatsapp_business_messaging',
      'business_management',
    ];

    // Berechtigungen pruefen
    try {
      const antwort = await fetch(
        `https://graph.facebook.com/v18.0/me/permissions?access_token=${konfig.zugriffstoken}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (antwort.ok) {
        const json = await antwort.json() as { data?: Array<{ permission: string; status: string }> };
        const erteilt = (json.data || []).filter((p) => p.status === 'granted').map((p) => p.permission);
        befund.erteilteBerechtigungen = erteilt;
        befund.fehlendeBerechtigungen = benoetigt.filter((b) => !erteilt.includes(b));
      }
    } catch { /* diagnostisch */ }

    if (befund.fehlendeBerechtigungen.length > 0) {
      befund.empfehlungen.push(
        `Fehlende Berechtigung(en): ${befund.fehlendeBerechtigungen.join(', ')}. Bitte WhatsApp neu verbinden und im OAuth-Dialog alle Haeckchen setzen.`
      );
    }

    // WABAs, Phone Numbers, Templates
    const { metaWabaListeAbrufen, metaPhoneNumbersAbrufen, metaTemplatesAbrufen } = await import('../dienste/whatsapp-meta.dienst');
    const wabas = await metaWabaListeAbrufen(konfig.zugriffstoken);

    for (const waba of wabas) {
      const phoneNumbers = await metaPhoneNumbersAbrufen(waba.id, konfig.zugriffstoken);
      const templates = await metaTemplatesAbrufen(waba.id, konfig.zugriffstoken);
      const approved = templates.filter((t) => t.status === 'APPROVED').length;

      befund.wabas.push({
        id: waba.id,
        name: waba.name,
        istVerbunden: waba.id === konfig.waba_id,
        phoneNumbers: phoneNumbers.map((n) => ({
          id: n.id,
          displayPhoneNumber: n.display_phone_number,
          verifiedName: n.verified_name,
          qualityRating: n.quality_rating,
        })),
        templateAnzahl: templates.length,
        templateGenehmigt: approved,
      });
    }

    // Empfehlungen ableiten
    if (wabas.length === 0) {
      befund.empfehlungen.push(
        'Keine WhatsApp Business Accounts gefunden. Der Kunde hat moeglicherweise noch kein WABA eingerichtet. Bitte im Meta Business Manager ein WhatsApp Business Account anlegen.'
      );
    } else {
      const verbunden = befund.wabas.find((w) => w.istVerbunden);
      if (!verbunden) {
        befund.empfehlungen.push(
          `WABA wurde nicht zugeordnet. Bitte in der Kampagnen-Konfiguration eine Phone Number auswaehlen.`
        );
      } else if (verbunden.phoneNumbers.length === 0) {
        befund.empfehlungen.push(
          `Die verbundene WABA "${verbunden.name}" hat keine Telefonnummer. Bitte bei Meta eine Nummer verifizieren.`
        );
      } else if ((verbunden.templateGenehmigt || 0) === 0) {
        befund.empfehlungen.push(
          `Die WABA "${verbunden.name}" hat noch keine genehmigten Templates. Bitte im Meta Business Manager Message-Templates einreichen und warten bis sie den Status APPROVED haben (typisch 24h).`
        );
      } else {
        befund.empfehlungen.push(
          `Alles in Ordnung: ${verbunden.templateGenehmigt} genehmigte Template(s) verfuegbar.`
        );
      }
    }

    res.json({ erfolg: true, daten: befund });
  } catch (fehler) {
    next(fehler);
  }
});
