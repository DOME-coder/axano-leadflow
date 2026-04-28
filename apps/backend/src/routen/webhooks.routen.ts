import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../datenbank/prisma.client';
import { AppFehler } from '../middleware/fehlerbehandlung';
import { webhookSignaturVerifizieren } from '../hilfsfunktionen/webhook.verifikation';
import { leadErstellen } from '../dienste/lead.dienst';
import { facebookLeadAbrufen, facebookWebhookPayloadParsen, FacebookTokenInvalidFehler, facebookPageTokenErneuern } from '../dienste/facebook.dienst';
import { superchatNachrichtParsen } from '../dienste/whatsapp.dienst';
import { integrationKonfigurationLesenMitFallback } from '../dienste/integrationen.dienst';
import { socketServer } from '../websocket/socket.handler';
import { logger } from '../hilfsfunktionen/logger';
import { telefonNormalisieren } from '../hilfsfunktionen/telefon.formatierung';

export const webhooksRouter = Router();

// ──────────────────────────────────────────────
// Generischer Webhook (Webformular)
// ──────────────────────────────────────────────
webhooksRouter.post('/:kampagneSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneSlug } = req.params;

    // Honeypot-Spam-Schutz
    if (req.body._honeypot) {
      res.status(200).json({ erfolg: true });
      return;
    }

    const kampagne = await prisma.kampagne.findUnique({
      where: { webhookSlug: kampagneSlug },
      include: { felder: true },
    });

    if (!kampagne) {
      throw new AppFehler('Kampagne nicht gefunden', 404, 'WEBHOOK_NICHT_GEFUNDEN');
    }

    if (kampagne.status !== 'aktiv') {
      throw new AppFehler('Kampagne ist nicht aktiv', 400, 'KAMPAGNE_INAKTIV');
    }

    // HMAC-Signatur prüfen (falls konfiguriert)
    const triggerKonfig = kampagne.triggerKonfiguration as Record<string, unknown> | null;
    const signaturGeheimnis = triggerKonfig?.signatur_geheimnis as string | undefined;

    if (signaturGeheimnis) {
      const signatur = typeof req.headers['x-axano-signatur'] === 'string'
        ? req.headers['x-axano-signatur']
        : undefined;
      const rohDaten = JSON.stringify(req.body);

      if (!signatur || !webhookSignaturVerifizieren(rohDaten, signatur, signaturGeheimnis)) {
        logger.warn(`Webhook-Signaturprüfung fehlgeschlagen für ${kampagneSlug}`);
        throw new AppFehler('Ungültige Signatur', 401, 'SIGNATUR_UNGUELTIG');
      }
    }

    logger.info(`Webhook empfangen: ${kampagneSlug}`, { body: req.body });

    const body = req.body as Record<string, unknown>;
    const felddaten: Record<string, string> = {};

    const vorname = extrahiere(body, ['vorname', 'first_name', 'firstname', 'name']);
    const nachname = extrahiere(body, ['nachname', 'last_name', 'lastname', 'surname']);
    const email = extrahiere(body, ['email', 'e_mail', 'mail', 'email_address']);
    const telefon = extrahiere(body, ['telefon', 'phone', 'phone_number', 'tel', 'telefonnummer', 'mobile']);

    for (const feld of kampagne.felder) {
      const wert = body[feld.feldname];
      if (wert !== undefined && wert !== null) {
        felddaten[feld.feldname] = String(wert);
      }
    }

    // Quellen-Kennzeichnung: webformular falls Trigger-Typ passt, sonst Kampagnen-Trigger
    const quelle = kampagne.triggerTyp === 'webformular' ? 'webformular' : kampagne.triggerTyp;

    const lead = await leadErstellen({
      kampagneId: kampagne.id,
      vorname: vorname || undefined,
      nachname: nachname || undefined,
      email: email || undefined,
      telefon: telefon || undefined,
      quelle,
      rohdaten: body,
      felddaten,
    });

    // Redirect-URL falls konfiguriert (für Formular-Einreichungen)
    const redirectUrl = triggerKonfig?.redirect_url as string | undefined;
    if (redirectUrl) {
      res.status(201).json({
        erfolg: true,
        daten: { leadId: lead.id, istDuplikat: lead.istDuplikat, redirect: redirectUrl },
      });
      return;
    }

    res.status(201).json({
      erfolg: true,
      daten: { leadId: lead.id, istDuplikat: lead.istDuplikat },
    });
  } catch (fehler) {
    next(fehler);
  }
});

// ──────────────────────────────────────────────
// Facebook Lead Ads
// ──────────────────────────────────────────────
// Verify-Handshake fuer Facebook Lead Ads.
// Meta erwartet, dass Verify-GET und Lead-POST unter DERSELBEN URL laufen.
// Deshalb akzeptieren wir den Verify sowohl unter dem Legacy-Pfad /facebook/verify
// als auch unter /facebook/:kampagneSlug — letzteres ist die URL, die in der
// Meta-App fuer eine konkrete Kampagne eingetragen wird.
const facebookVerifyHandler = (req: Request, res: Response): void => {
  const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Verifikation fehlgeschlagen');
  }
};

webhooksRouter.get('/facebook/verify', facebookVerifyHandler);
webhooksRouter.get('/facebook/:kampagneSlug', facebookVerifyHandler);

webhooksRouter.post('/facebook/:kampagneSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneSlug } = req.params;

    const fbSignatur = typeof req.headers['x-hub-signature-256'] === 'string'
      ? req.headers['x-hub-signature-256']
      : undefined;
    const fbGeheimnis = process.env.FACEBOOK_APP_GEHEIMNIS;

    // In Produktion: App-Secret MUSS gesetzt sein. Kein Fallback auf "ohne Pruefung"
    // — sonst kann jeder Fake-Leads einschleusen, die echte Anrufe ausloesen.
    if (!fbGeheimnis) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('Facebook-Webhook abgelehnt: FACEBOOK_APP_GEHEIMNIS nicht gesetzt — Webhook wird in Produktion nicht akzeptiert');
        throw new AppFehler('Server nicht korrekt konfiguriert', 500, 'FB_APP_GEHEIMNIS_FEHLT');
      }
      logger.warn('Facebook-Webhook: FACEBOOK_APP_GEHEIMNIS nicht gesetzt — Signatur-Verifikation uebersprungen (nur im Dev-Modus erlaubt).');
    } else {
      // Secret vorhanden: Signatur MUSS mitgeschickt und gueltig sein.
      if (!fbSignatur) {
        logger.warn('Facebook-Webhook ohne x-hub-signature-256-Header abgelehnt');
        throw new AppFehler('Fehlende Signatur', 401, 'FB_SIGNATUR_FEHLT');
      }
      // WICHTIG: Signatur ueber den ROHEN Body pruefen, nicht ueber das von
      // Express geparste + neu serialisierte JSON. Sonst schlaegt die Pruefung
      // fehl, sobald Meta auch nur ein anderes Whitespace-Format nutzt.
      const rohBody = (req as Request & { rawBody?: string }).rawBody;
      if (!rohBody) {
        logger.error('Facebook-Webhook: rawBody fehlt — Signatur kann nicht geprueft werden');
        throw new AppFehler('Server-Konfigurationsfehler', 500, 'FB_RAWBODY_FEHLT');
      }
      if (!webhookSignaturVerifizieren(rohBody, fbSignatur, fbGeheimnis)) {
        throw new AppFehler('Ungültige Facebook-Signatur', 401, 'FB_SIGNATUR_UNGUELTIG');
      }
    }

    const kampagne = await prisma.kampagne.findUnique({
      where: { webhookSlug: kampagneSlug },
      include: { felder: true },
    });

    if (!kampagne || kampagne.status !== 'aktiv') {
      throw new AppFehler('Kampagne nicht gefunden oder inaktiv', 404, 'KAMPAGNE_NICHT_GEFUNDEN');
    }

    const entry = req.body.entry;
    if (!Array.isArray(entry)) {
      res.status(200).json({ erfolg: true });
      return;
    }

    // Facebook-Zugriffstoken aus Kampagnen-Konfiguration oder Integration lesen
    // Unterstuetzt sowohl das alte Feld (seiten_zugriffstoken) als auch das neue (page_access_token)
    const triggerKonfig = kampagne.triggerKonfiguration as Record<string, string> | null;
    let zugriffstoken = triggerKonfig?.seiten_zugriffstoken;
    let userZugriffstoken: string | undefined;
    let pageId: string | undefined;

    if (!zugriffstoken) {
      const fbKonfig = await integrationKonfigurationLesenMitFallback('facebook', kampagne.kundeId);
      zugriffstoken = fbKonfig?.page_access_token || fbKonfig?.seiten_zugriffstoken;
      userZugriffstoken = fbKonfig?.user_access_token;
      pageId = fbKonfig?.page_id;
    }

    // Form-IDs aus der Trigger-Konfiguration (falls gesetzt → nur diese Forms akzeptieren)
    const erlaubteFormIds = triggerKonfig?.form_ids as string[] | undefined;

    for (const eintrag of entry) {
      const changes = eintrag.changes || [];
      for (const aenderung of changes) {
        if (aenderung.field === 'leadgen') {
          // Form-ID-Filter: Wenn form_ids konfiguriert → nur Leads von diesen Formularen
          const webhookFormId = aenderung.value?.form_id as string | undefined;
          if (erlaubteFormIds?.length && webhookFormId && !erlaubteFormIds.includes(webhookFormId)) {
            logger.info(`Facebook-Lead von Form ${webhookFormId} uebersprungen — nicht in erlaubten Forms: ${erlaubteFormIds.join(', ')}`);
            continue;
          }

          let leadDaten;

          // Feldmappings aus der Trigger-Konfiguration laden
          const feldMappings = triggerKonfig?.feldMappings as Array<{ facebookFeldname: string; kampagneFeldname: string }> | undefined;

          // Versuch 1: Lead-Daten per Graph API abrufen (vollständig)
          if (zugriffstoken && aenderung.value?.leadgen_id) {
            try {
              leadDaten = await facebookLeadAbrufen(aenderung.value.leadgen_id, zugriffstoken, feldMappings);
            } catch (fehler) {
              if (fehler instanceof FacebookTokenInvalidFehler) {
                // Token abgelaufen/invalidiert. Versuch 1b: mit user_access_token einmalig
                // einen neuen Page-Token holen und Lead-Abruf wiederholen.
                logger.error('Facebook Page Access Token abgelaufen', {
                  kampagne: kampagne.name,
                  kundeId: kampagne.kundeId,
                  leadgenId: aenderung.value.leadgen_id,
                  fbCode: fehler.fbCode,
                });
                if (userZugriffstoken && pageId) {
                  const neuerToken = await facebookPageTokenErneuern(pageId, userZugriffstoken);
                  if (neuerToken) {
                    logger.info('Facebook Page Access Token erneuert (in-memory) — Lead-Abruf wird wiederholt', {
                      kampagne: kampagne.name,
                    });
                    try {
                      leadDaten = await facebookLeadAbrufen(aenderung.value.leadgen_id, neuerToken, feldMappings);
                      // Hinweis: Persistierung des neuen Tokens in die Integrations-Konfiguration
                      // ist ein Folge-Schritt — Admin muss manuell die Integration neu speichern,
                      // damit der Token beim naechsten Webhook nicht wieder abgelaufen ist.
                      logger.warn('Facebook-Token wurde fuer diesen Request erneuert. Bitte Integration im Admin-UI neu speichern, um den Token persistent zu aktualisieren.', {
                        kampagne: kampagne.name,
                        kundeId: kampagne.kundeId,
                      });
                    } catch (nochmal) {
                      logger.error('Facebook Lead-Abruf auch mit erneuertem Token fehlgeschlagen', {
                        leadgenId: aenderung.value.leadgen_id,
                        error: nochmal instanceof Error ? nochmal.message : nochmal,
                      });
                    }
                  }
                } else {
                  logger.error('Facebook-Token-Refresh nicht moeglich: kein user_access_token oder page_id konfiguriert. Admin muss die Integration neu verbinden.', {
                    kampagne: kampagne.name,
                    kundeId: kampagne.kundeId,
                    hatUserToken: !!userZugriffstoken,
                    hatPageId: !!pageId,
                  });
                }
              } else {
                logger.warn('Facebook Graph API Fallback auf Webhook-Payload', {
                  error: fehler instanceof Error ? fehler.message : fehler,
                  leadgenId: aenderung.value.leadgen_id,
                });
              }
            }
          }

          // Versuch 2: Webhook-Payload direkt parsen (Fallback — Realtime-Webhooks
          // enthalten allerdings standardmaessig KEIN field_data, deshalb ist der
          // Graph-API-Pfad oben der primaere Weg.)
          if (!leadDaten && aenderung.value?.field_data) {
            leadDaten = facebookWebhookPayloadParsen(aenderung.value.field_data, feldMappings);
          }

          if (leadDaten) {
            logger.info(`Facebook-Lead empfangen: ${leadDaten.vorname || '?'} ${leadDaten.nachname || '?'} (Kampagne: ${kampagne.name})`);
            await leadErstellen({
              kampagneId: kampagne.id,
              vorname: leadDaten.vorname,
              nachname: leadDaten.nachname,
              email: leadDaten.email,
              telefon: leadDaten.telefon,
              quelle: 'facebook_lead_ads',
              rohdaten: aenderung.value as Record<string, unknown>,
              felddaten: leadDaten.felddaten,
            });
          } else {
            logger.error('Facebook-Lead konnte NICHT verarbeitet werden — weder Graph API noch Webhook-Payload lieferten Daten', {
              kampagne: kampagne.name,
              kampagneSlug,
              leadgenId: aenderung.value?.leadgen_id || 'unbekannt',
              hatZugriffstoken: !!zugriffstoken,
              hatFieldData: !!aenderung.value?.field_data,
            });
          }
        }
      }
    }

    res.status(200).json({ erfolg: true });
  } catch (fehler) {
    next(fehler);
  }
});

// ──────────────────────────────────────────────
// Superchat (WhatsApp) Webhook
// ──────────────────────────────────────────────
webhooksRouter.post('/superchat/:kampagneSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneSlug } = req.params;

    const kampagne = await prisma.kampagne.findUnique({
      where: { webhookSlug: kampagneSlug },
    });

    if (!kampagne || kampagne.status !== 'aktiv') {
      throw new AppFehler('Kampagne nicht gefunden oder inaktiv', 404, 'KAMPAGNE_NICHT_GEFUNDEN');
    }

    // Signatur verifizieren
    const superchatKonfig = await integrationKonfigurationLesenMitFallback('superchat', kampagne.kundeId);
    const webhookGeheimnis = superchatKonfig?.webhook_geheimnis;

    if (webhookGeheimnis) {
      const signatur = typeof req.headers['x-superchat-signature'] === 'string'
        ? req.headers['x-superchat-signature']
        : undefined;
      const rohDaten = JSON.stringify(req.body);

      if (!signatur || !webhookSignaturVerifizieren(rohDaten, signatur, webhookGeheimnis)) {
        logger.warn(`Superchat-Signaturprüfung fehlgeschlagen für ${kampagneSlug}`);
        throw new AppFehler('Ungültige Signatur', 401, 'SIGNATUR_UNGUELTIG');
      }
    }

    // Nachricht parsen
    const kontaktDaten = superchatNachrichtParsen(req.body);
    if (!kontaktDaten) {
      res.status(200).json({ erfolg: true });
      return;
    }

    logger.info(`Superchat-Webhook empfangen: ${kampagneSlug}`, {
      telefon: kontaktDaten.telefon,
      event: req.body.event,
    });

    // Prüfen ob Lead mit dieser Telefonnummer schon existiert
    // Telefon normalisieren (Meta/Superchat liefert oft "493012345678" ohne +, gespeichert ist "+49301234567")
    const normalisierteTelefon = telefonNormalisieren(kontaktDaten.telefon);
    if (normalisierteTelefon) {
      const bestehenderLead = await prisma.lead.findFirst({
        where: {
          kampagneId: kampagne.id,
          telefon: normalisierteTelefon,
          geloescht: false,
        },
      });

      if (bestehenderLead) {
        // Aktivität loggen statt neuen Lead erstellen
        await prisma.leadAktivitaet.create({
          data: {
            leadId: bestehenderLead.id,
            typ: 'whatsapp_gesendet',
            beschreibung: `WhatsApp-Nachricht empfangen: ${kontaktDaten.nachricht?.substring(0, 100) || '(kein Text)'}`,
            metadaten: { nachricht: kontaktDaten.nachricht },
          },
        });

        res.status(200).json({ erfolg: true, daten: { leadId: bestehenderLead.id, bestehend: true } });
        return;
      }
    }

    // Neuer Lead erstellen
    const lead = await leadErstellen({
      kampagneId: kampagne.id,
      vorname: kontaktDaten.vorname,
      nachname: kontaktDaten.nachname,
      email: kontaktDaten.email,
      telefon: kontaktDaten.telefon,
      quelle: 'whatsapp',
      rohdaten: req.body as Record<string, unknown>,
    });

    res.status(201).json({
      erfolg: true,
      daten: { leadId: lead.id, istDuplikat: lead.istDuplikat },
    });
  } catch (fehler) {
    next(fehler);
  }
});

// ──────────────────────────────────────────────
// VAPI Tools Webhook (Kalender, Termin, Rückruf, Lead-Korrektur)
// ──────────────────────────────────────────────
webhooksRouter.post('/vapi/tools', async (req: Request, res: Response, _next: NextFunction) => {
  try {
    const { kalenderPruefen, terminBuchen, rueckrufPlanen, leadDatenKorrigieren } = await import('../dienste/vapi-tools.dienst');

    const toolCall = req.body?.message?.toolCalls?.[0];
    if (!toolCall) {
      res.status(200).json({ results: [] });
      return;
    }

    const toolName = toolCall.function?.name;
    const args = typeof toolCall.function?.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function?.arguments || {};
    const toolCallId = toolCall.id;

    // kundeId aus VAPI Call-Metadata extrahieren (wird beim Anruf-Start mitgesendet)
    const kundeId = req.body?.message?.call?.metadata?.kundeId || null;

    logger.info(`VAPI Tool-Call: ${toolName}`, { args, kundeId });

    let ergebnis = '';

    switch (toolName) {
      case 'kalenderPruefen':
        ergebnis = await kalenderPruefen(args.gewuenschteZeit, kundeId);
        break;

      case 'terminBuchen':
        ergebnis = await terminBuchen(args.gewuenschteZeit, args.telefonnummer, args.vorname, args.nachname, kundeId);
        break;

      case 'rueckrufPlanen':
        ergebnis = await rueckrufPlanen(args.telefonnummer, args.rueckrufZeit);
        break;

      case 'leadDatenKorrigieren':
        await leadDatenKorrigieren(args.telefonnummer, args.datenTyp, args.neuerWert);
        break;

      default:
        logger.warn(`Unbekannter VAPI Tool-Call: ${toolName}`);
        ergebnis = 'Dieses Tool ist nicht verfügbar.';
    }

    res.status(200).json({
      results: [{ toolCallId, result: ergebnis }],
    });
  } catch (fehler) {
    logger.error('VAPI Tool-Call fehlgeschlagen:', { error: fehler });
    res.status(200).json({
      results: [{ toolCallId: req.body?.message?.toolCalls?.[0]?.id, result: 'Oh, da scheint gerade etwas nicht zu funktionieren. Ich notiere mir das und wir kümmern uns darum.' }],
    });
  }
});

// ──────────────────────────────────────────────
// VAPI End-of-Call Webhook
// ──────────────────────────────────────────────
webhooksRouter.post('/vapi', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Secret-Verification: WENN ein Secret konfiguriert ist, muss es matchen — sonst
    // koennten beliebige Aufrufer gefaelschte End-of-Call-Reports einschleusen und Leads
    // als "Termin gebucht" markieren. WENN keins konfiguriert ist, akzeptieren wir den
    // Webhook (mit Warning), damit das bestehende Setup nicht bricht. Empfehlung: Secret
    // in Coolify-Env als VAPI_WEBHOOK_SECRET hinterlegen, dann ist der Schutz aktiv.
    const vapiKonfig = await integrationKonfigurationLesenMitFallback('vapi');
    const webhookSecret = vapiKonfig?.webhook_secret || process.env.VAPI_WEBHOOK_SECRET;
    if (!webhookSecret) {
      if (process.env.NODE_ENV === 'production') {
        logger.warn('VAPI Webhook: kein webhook_secret konfiguriert — Pruefung uebersprungen. Setze VAPI_WEBHOOK_SECRET fuer Produktions-Sicherheit.');
      }
    } else {
      const empfangen = req.headers['x-vapi-secret'];
      if (typeof empfangen !== 'string' || empfangen !== webhookSecret) {
        logger.warn('VAPI Webhook mit ungültigem Secret empfangen');
        res.status(401).json({ erfolg: false, fehler: 'Ungültiges Webhook-Secret' });
        return;
      }
    }

    const body = req.body;
    const nachrichtTyp = body?.message?.type;

    // Nur End-of-Call-Reports verarbeiten
    if (nachrichtTyp !== 'end-of-call-report') {
      res.status(200).json({ erfolg: true });
      return;
    }

    const callId = body.message?.call?.id as string | undefined;
    const transkript = body.message?.transcript as string || body.message?.artifact?.transcript as string || '';
    const endedReason = body.message?.endedReason as string || '';
    const dauer = body.message?.call?.duration as number | undefined;

    if (!callId) {
      logger.warn('VAPI Webhook ohne Call-ID empfangen');
      res.status(200).json({ erfolg: true });
      return;
    }

    // Idempotenz-Check: Bereits verarbeitete Anrufe überspringen
    const bereitsVerarbeitet = await prisma.anrufVersuch.findUnique({
      where: { vapiCallId: callId },
      select: { status: true },
    });

    if (bereitsVerarbeitet?.status === 'abgeschlossen') {
      logger.info(`VAPI Webhook für bereits verarbeiteten Anruf ${callId} – übersprungen`);
      res.status(200).json({ erfolg: true });
      return;
    }

    logger.info(`VAPI Webhook empfangen: Call ${callId}, Reason: ${endedReason}`);

    // Dynamischer Import um zirkuläre Abhängigkeiten zu vermeiden
    const { anrufErgebnisVerarbeiten } = await import('../dienste/anruf.dienst');
    await anrufErgebnisVerarbeiten(callId, transkript, endedReason, dauer);

    res.status(200).json({ erfolg: true });
  } catch (fehler) {
    next(fehler);
  }
});

// ──────────────────────────────────────────────
// Calendly Webhook
// ──────────────────────────────────────────────
webhooksRouter.post('/calendly', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    const eventTyp = body.event;

    // Nur Terminbuchungen und Stornierungen verarbeiten
    if (eventTyp !== 'invitee.created' && eventTyp !== 'invitee.canceled') {
      res.status(200).json({ erfolg: true });
      return;
    }

    const payload = body.payload;
    const email = payload?.email as string | undefined;
    const name = payload?.name as string | undefined;
    const scheduledAt = payload?.scheduled_event?.start_time as string | undefined;

    // Meeting-Link und Telefon aus Payload extrahieren
    const meetingLink = payload?.scheduled_event?.location?.join_url as string | undefined;
    const questionsAndAnswers = payload?.questions_and_answers as Array<{ answer: string }> | undefined;
    const telefonAusFormular = questionsAndAnswers?.[0]?.answer?.replace(/\s+/g, '') || undefined;

    // Signatur-Pruefung MUSS vor jeglichem DB-Write passieren — sonst kann jeder
    // im Internet unsere Webhook-URL abfeuern und Leads/Termine manipulieren.
    // Wir pruefen zuerst mit globaler Calendly-Config (Baseline-Schutz);
    // wenn gar keine Konfiguration existiert, wird der Webhook in Prod abgelehnt.
    const globaleCalendly = await integrationKonfigurationLesenMitFallback('calendly', null);
    const signingKey = globaleCalendly?.webhook_signing_key;

    if (!signingKey) {
      if (process.env.NODE_ENV === 'production') {
        logger.error('Calendly-Webhook abgelehnt: globaler webhook_signing_key fehlt');
        res.status(500).json({ erfolg: false, fehler: 'Server nicht konfiguriert' });
        return;
      }
      logger.warn('Calendly Webhook: kein signing_key konfiguriert — Signatur-Pruefung uebersprungen (nur im Dev-Modus erlaubt)');
    } else {
      const signaturHeader = typeof req.headers['calendly-webhook-signature'] === 'string'
        ? (req.headers['calendly-webhook-signature'] as string)
        : '';
      const teile = Object.fromEntries(
        signaturHeader.split(',').map((p) => p.split('=').map((s) => s.trim())),
      ) as Record<string, string>;
      const t = teile.t;
      const v1 = teile.v1;
      if (!t || !v1) {
        logger.warn('Calendly Webhook: Signatur-Header fehlt oder ungültig');
        res.status(401).json({ erfolg: false, fehler: 'Ungültige Signatur' });
        return;
      }
      const crypto = await import('crypto');
      const erwartet = crypto.createHmac('sha256', signingKey)
        .update(`${t}.${JSON.stringify(req.body)}`, 'utf8')
        .digest('hex');
      try {
        const ok = crypto.timingSafeEqual(Buffer.from(v1, 'hex'), Buffer.from(erwartet, 'hex'));
        if (!ok) {
          logger.warn('Calendly Webhook: Signatur stimmt nicht überein');
          res.status(401).json({ erfolg: false, fehler: 'Ungültige Signatur' });
          return;
        }
      } catch {
        res.status(401).json({ erfolg: false, fehler: 'Ungültige Signatur' });
        return;
      }
    }

    // Idempotenz-Check: Calendly retried bei 5xx, ohne Schutz wuerden bei
    // jedem Retry ein zweiter Termin und doppelte Status-Updates entstehen.
    // payload.uri ist pro Calendly-Buchung eindeutig.
    const calendlyEventUri = payload?.uri as string | undefined;
    if (eventTyp === 'invitee.created' && calendlyEventUri) {
      const bereitsVerarbeitet = await prisma.termin.findUnique({
        where: { externeId: calendlyEventUri },
        select: { id: true },
      });
      if (bereitsVerarbeitet) {
        logger.info(`Calendly: Duplikat-Event ${calendlyEventUri} ignoriert (Termin ${bereitsVerarbeitet.id} existiert bereits)`);
        res.status(200).json({ erfolg: true });
        return;
      }
    }

    // Lead erst NACH erfolgreicher Signatur-Pruefung suchen.
    let lead = email ? await prisma.lead.findFirst({
      where: { geloescht: false, email },
      orderBy: { erstelltAm: 'desc' },
      include: { kampagne: { select: { kundeId: true } } },
    }) : null;

    if (!lead && telefonAusFormular) {
      lead = await prisma.lead.findFirst({
        where: { geloescht: false, telefon: { contains: telefonAusFormular.replace(/^\+49/, '').replace(/^0/, '') } },
        orderBy: { erstelltAm: 'desc' },
        include: { kampagne: { select: { kundeId: true } } },
      });
    }

    logger.info(`Calendly Webhook: ${eventTyp}, E-Mail: ${email}`);

    if (!email && !name) {
      res.status(200).json({ erfolg: true });
      return;
    }

    // Stornierung: Termin entfernen + Status zurücksetzen
    if (eventTyp === 'invitee.canceled' && lead) {
      const externeId = payload?.uri as string | undefined;
      if (externeId) {
        await prisma.termin.deleteMany({
          where: { leadId: lead.id, externeId },
        });
      }
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'Termin storniert' },
      });
      await prisma.leadStatusHistorie.create({
        data: {
          leadId: lead.id,
          alterStatus: lead.status,
          neuerStatus: 'Termin storniert',
          grund: 'Calendly-Stornierung',
        },
      });
      await prisma.leadAktivitaet.create({
        data: {
          leadId: lead.id,
          typ: 'status_geaendert',
          beschreibung: 'Termin über Calendly storniert',
        },
      });
      logger.info(`Calendly: Lead ${lead.id} → Termin storniert`);
      res.status(200).json({ erfolg: true });
      return;
    }

    if (lead) {
      // Status auf "Termin gebucht" setzen
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: 'Termin gebucht' },
      });

      await prisma.leadStatusHistorie.create({
        data: {
          leadId: lead.id,
          alterStatus: lead.status,
          neuerStatus: 'Termin gebucht',
          grund: 'Calendly-Terminbuchung',
        },
      });

      // Termin speichern (mit Meeting-Link)
      const beginn = scheduledAt ? new Date(scheduledAt) : new Date();
      const ende = payload?.scheduled_event?.end_time ? new Date(payload.scheduled_event.end_time) : new Date(beginn.getTime() + 30 * 60 * 1000);
      const termin = await prisma.termin.create({
        data: {
          leadId: lead.id,
          kampagneId: lead.kampagneId,
          titel: `Calendly-Termin: ${name || email}`,
          beginnAm: beginn,
          endeAm: ende,
          quelle: 'calendly',
          externeId: payload?.uri as string || undefined,
          meetingLink: meetingLink || undefined,
        },
      });

      // Versuch: Termin in den Kalender des Kunden eintragen (Google/Outlook)
      try {
        const { kalenderAnbieterErstellen } = await import('../dienste/kalender.dienst');
        const anbieter = await kalenderAnbieterErstellen(lead.kampagne?.kundeId || null);
        if (anbieter) {
          const ergebnis = await anbieter.terminErstellen({
            titel: `Beratungstermin: ${name || email}`,
            beschreibung: `Termin über Calendly gebucht.\n\nLead: ${name || '—'}\nE-Mail: ${email || '—'}\nTelefon: ${lead.telefon || '—'}${meetingLink ? `\n\nMeeting-Link: ${meetingLink}` : ''}`,
            beginn,
            ende,
            teilnehmerEmail: email,
          });
          // Speichere die externe Kalender-ID zusätzlich
          if (ergebnis.externeId) {
            await prisma.termin.update({
              where: { id: termin.id },
              data: { meetingLink: ergebnis.meetingLink || meetingLink || undefined },
            });
          }
          logger.info(`Calendly: Termin auch in Kunden-Kalender eingetragen (Lead ${lead.id})`);
        } else {
          logger.info(`Calendly: Kein Kunden-Kalender verbunden für Lead ${lead.id} – nur DB-Eintrag`);
        }
      } catch (kalenderFehler) {
        logger.error('Calendly: Kalender-Eintragung fehlgeschlagen', { leadId: lead.id, error: kalenderFehler });
      }

      await prisma.leadAktivitaet.create({
        data: {
          leadId: lead.id,
          typ: 'termin_gebucht',
          beschreibung: `Termin über Calendly gebucht${scheduledAt ? ` am ${new Date(scheduledAt).toLocaleString('de-DE')}` : ''}${meetingLink ? ` – Meeting: ${meetingLink}` : ''}`,
        },
      });

      // Echtzeit-Event
      const io = socketServer();
      if (io) {
        io.to(`kampagne:${lead.kampagneId}`).emit('lead:aktualisiert', {
          lead: { ...lead, status: 'Termin gebucht' },
        });
      }

      logger.info(`Calendly: Lead ${lead.id} → Termin gebucht${meetingLink ? ` (Meeting: ${meetingLink})` : ''}`);
    } else {
      // Fallback: Admin-E-Mail senden
      logger.warn(`Calendly: Kein Lead gefunden für ${email || telefonAusFormular}`);
      try {
        const { emailSenden } = await import('../dienste/email.dienst');
        await emailSenden({
          an: process.env.ADMIN_EMAIL || 'admin@axano.de',
          betreff: 'Calendly: Termin gebucht – Lead nicht gefunden',
          html: `<p>Ein Termin wurde über Calendly gebucht, aber der Lead konnte nicht zugeordnet werden.</p>
            <p><strong>Name:</strong> ${name || '—'}</p>
            <p><strong>E-Mail:</strong> ${email || '—'}</p>
            <p><strong>Telefon:</strong> ${telefonAusFormular || '—'}</p>
            <p><strong>Termin:</strong> ${scheduledAt || '—'}</p>
            <p>Bitte manuell zuordnen.</p>`,
        });
      } catch {
        // E-Mail-Versand fehlgeschlagen → nur loggen
      }
    }

    res.status(200).json({ erfolg: true });
  } catch (fehler) {
    next(fehler);
  }
});

function extrahiere(obj: Record<string, unknown>, schluessel: string[]): string | undefined {
  for (const s of schluessel) {
    if (obj[s] !== undefined && obj[s] !== null && obj[s] !== '') {
      return String(obj[s]);
    }
  }
  return undefined;
}

// ──────────────────────────────────────────────
// Meta WhatsApp Business Cloud API – Webhook
// ──────────────────────────────────────────────

// GET /api/v1/webhooks/whatsapp-meta – Verify-Challenge bei Webhook-Einrichtung
webhooksRouter.get('/whatsapp-meta', async (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Globaler Verify-Token kommt aus ENV (pro Meta-App nur einer)
  const erwartet = process.env.FACEBOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && typeof token === 'string' && typeof challenge === 'string' && token === erwartet) {
    logger.info('WhatsApp-Meta Webhook verifiziert');
    res.status(200).send(challenge);
    return;
  }

  logger.warn('WhatsApp-Meta Webhook-Verifikation fehlgeschlagen');
  res.sendStatus(403);
});

// POST /api/v1/webhooks/whatsapp-meta – eingehende Nachrichten/Status
webhooksRouter.post('/whatsapp-meta', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Signatur pruefen (App-Secret der Meta-App)
    const appSecret = process.env.FACEBOOK_APP_GEHEIMNIS;
    const signatur = req.headers['x-hub-signature-256'];
    const rohBody = (req as Request & { rawBody?: string }).rawBody;

    if (appSecret && rohBody) {
      const { metaWebhookSignaturPruefen } = await import('../dienste/whatsapp-meta.dienst');
      const istGueltig = metaWebhookSignaturPruefen(
        rohBody,
        typeof signatur === 'string' ? signatur : undefined,
        appSecret,
      );
      if (!istGueltig) {
        logger.warn('WhatsApp-Meta Webhook: Signatur stimmt nicht ueberein');
        res.sendStatus(401);
        return;
      }
    } else if (!appSecret) {
      logger.warn('WhatsApp-Meta Webhook: FACEBOOK_APP_GEHEIMNIS fehlt, Signatur-Pruefung uebersprungen');
    }

    const { metaEingehendeNachrichtParsen } = await import('../dienste/whatsapp-meta.dienst');
    const nachrichten = metaEingehendeNachrichtParsen(req.body);

    if (nachrichten.length === 0) {
      // Status-Updates oder andere Events – schnell 200 zurueck
      res.status(200).json({ erfolg: true });
      return;
    }

    // Fuer jede Nachricht: Kampagne ueber phone_number_id finden → Lead suchen/erstellen
    for (const nachricht of nachrichten) {
      // Kampagne ueber whatsappMetaPhoneNumberId zuordnen
      const kampagne = await prisma.kampagne.findFirst({
        where: {
          whatsappMetaPhoneNumberId: nachricht.phoneNumberId,
          geloescht: false,
        },
        select: { id: true, kundeId: true, name: true },
      });

      if (!kampagne) {
        logger.warn(`WhatsApp-Meta: Keine Kampagne mit phone_number_id ${nachricht.phoneNumberId} gefunden`);
        continue;
      }

      // Bestehenden Lead suchen (per Telefon, auf derselben Kampagne)
      // Telefon normalisieren — Meta liefert oft "493012345678" ohne +, gespeichert ist "+493012345678"
      const normalisierteTelefon = telefonNormalisieren(nachricht.vonTelefon) ?? nachricht.vonTelefon;
      const lead = await prisma.lead.findFirst({
        where: {
          kampagneId: kampagne.id,
          telefon: normalisierteTelefon,
          geloescht: false,
        },
        select: { id: true, status: true },
      });

      if (lead) {
        // Aktivitaet loggen + Status auf "WhatsApp erhalten" setzen
        await prisma.leadAktivitaet.create({
          data: {
            leadId: lead.id,
            typ: 'whatsapp_empfangen',
            beschreibung: nachricht.text
              ? `WhatsApp-Nachricht empfangen: ${nachricht.text.substring(0, 500)}`
              : `WhatsApp-Event empfangen (${nachricht.typ})`,
            metadaten: {
              metaMessageId: nachricht.metaMessageId,
              phoneNumberId: nachricht.phoneNumberId,
              zeitstempel: nachricht.zeitstempel.toISOString(),
            },
          },
        });

        // Status auf "WhatsApp erhalten" setzen (nur wenn nicht schon Endstatus)
        const endStati = ['Termin gebucht', 'Nicht interessiert', 'Falsche Nummer', 'Nicht erreichbar'];
        if (!endStati.includes(lead.status)) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: 'WhatsApp erhalten' },
          });
          const io = socketServer();
          if (io) {
            io.to(`kampagne:${kampagne.id}`).emit('lead:aktualisiert', {
              lead: { id: lead.id, status: 'WhatsApp erhalten' },
            });
          }
        }

        logger.info(`WhatsApp-Meta: Nachricht von ${nachricht.vonTelefon} zu Lead ${lead.id} (Kampagne ${kampagne.name}) eingetragen`);
      } else {
        // Neuer Lead (wie bei Superchat-Flow)
        const neuerLead = await leadErstellen({
          kampagneId: kampagne.id,
          vorname: nachricht.vonName?.split(/\s+/)[0],
          nachname: nachricht.vonName?.split(/\s+/).slice(1).join(' ') || undefined,
          telefon: nachricht.vonTelefon,
          quelle: 'whatsapp',
          rohdaten: {
            metaMessageId: nachricht.metaMessageId,
            phoneNumberId: nachricht.phoneNumberId,
            text: nachricht.text,
            zeitstempel: nachricht.zeitstempel.toISOString(),
          },
        });
        logger.info(`WhatsApp-Meta: Neuer Lead ${neuerLead.id} aus WhatsApp-Nachricht (Kampagne ${kampagne.name})`);
      }
    }

    res.status(200).json({ erfolg: true });
  } catch (fehler) {
    logger.error('WhatsApp-Meta Webhook-Verarbeitung fehlgeschlagen', { error: fehler });
    next(fehler);
  }
});
