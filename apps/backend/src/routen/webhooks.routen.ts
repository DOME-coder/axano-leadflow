import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../datenbank/prisma.client';
import { AppFehler } from '../middleware/fehlerbehandlung';
import { webhookSignaturVerifizieren } from '../hilfsfunktionen/webhook.verifikation';
import { leadErstellen } from '../dienste/lead.dienst';
import { facebookLeadAbrufen, facebookWebhookPayloadParsen } from '../dienste/facebook.dienst';
import { superchatNachrichtParsen } from '../dienste/whatsapp.dienst';
import { integrationKonfigurationLesenMitFallback } from '../dienste/integrationen.dienst';
import { socketServer } from '../websocket/socket.handler';
import { logger } from '../hilfsfunktionen/logger';

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
webhooksRouter.get('/facebook/verify', (req: Request, res: Response) => {
  const verifyToken = process.env.FACEBOOK_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Verifikation fehlgeschlagen');
  }
});

webhooksRouter.post('/facebook/:kampagneSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneSlug } = req.params;

    const fbSignatur = typeof req.headers['x-hub-signature-256'] === 'string'
      ? req.headers['x-hub-signature-256']
      : undefined;
    const fbGeheimnis = process.env.FACEBOOK_APP_GEHEIMNIS;

    if (fbGeheimnis && fbSignatur) {
      const rohDaten = JSON.stringify(req.body);
      if (!webhookSignaturVerifizieren(rohDaten, fbSignatur, fbGeheimnis)) {
        throw new AppFehler('Ungültige Facebook-Signatur', 401, 'FB_SIGNATUR_UNGUELTIG');
      }
    } else if (!fbGeheimnis) {
      logger.warn('Facebook-Webhook: FACEBOOK_APP_GEHEIMNIS nicht gesetzt — Signatur-Verifikation uebersprungen. Bitte in Coolify-ENV setzen!');
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
    const triggerKonfig = kampagne.triggerKonfiguration as Record<string, string> | null;
    let zugriffstoken = triggerKonfig?.seiten_zugriffstoken;

    if (!zugriffstoken) {
      const fbKonfig = await integrationKonfigurationLesenMitFallback('facebook', kampagne.kundeId);
      zugriffstoken = fbKonfig?.seiten_zugriffstoken;
    }

    for (const eintrag of entry) {
      const changes = eintrag.changes || [];
      for (const aenderung of changes) {
        if (aenderung.field === 'leadgen') {
          let leadDaten;

          // Feldmappings aus der Trigger-Konfiguration laden
          const feldMappings = triggerKonfig?.feldMappings as Array<{ facebookFeldname: string; kampagneFeldname: string }> | undefined;

          // Versuch 1: Lead-Daten per Graph API abrufen (vollständig)
          if (zugriffstoken && aenderung.value?.leadgen_id) {
            try {
              leadDaten = await facebookLeadAbrufen(aenderung.value.leadgen_id, zugriffstoken, feldMappings);
            } catch {
              logger.warn('Facebook Graph API Fallback auf Webhook-Payload');
            }
          }

          // Versuch 2: Webhook-Payload direkt parsen (Fallback)
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
    if (kontaktDaten.telefon) {
      const bestehenderLead = await prisma.lead.findFirst({
        where: {
          kampagneId: kampagne.id,
          telefon: kontaktDaten.telefon,
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
    // Optionale Secret-Verification – aus Integrations-Konfiguration oder Umgebungsvariable
    const vapiKonfig = await integrationKonfigurationLesenMitFallback('vapi');
    const webhookSecret = vapiKonfig?.webhook_secret || process.env.VAPI_WEBHOOK_SECRET;
    if (webhookSecret && req.headers['x-vapi-secret'] !== webhookSecret) {
      logger.warn('VAPI Webhook mit ungültigem Secret empfangen');
      res.status(401).json({ erfolg: false, fehler: 'Ungültiges Webhook-Secret' });
      return;
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

    // Lead zuerst ermitteln, weil wir den kundeId für die Signature-Prüfung brauchen
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

    // Signaturverifikation: Calendly-Format ist "t=<unix>,v1=<hex>"
    // HMAC-Berechnung über "<t>.<rohpayload>" mit dem signing_key des Kunden
    const calendlyKonfig = await integrationKonfigurationLesenMitFallback(
      'calendly',
      lead?.kampagne?.kundeId || null,
    );
    const signingKey = calendlyKonfig?.webhook_signing_key;
    if (signingKey) {
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
