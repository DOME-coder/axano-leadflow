import { prisma } from '../datenbank/prisma.client';
import { vapiAnrufStarten } from './vapi.dienst';
import { transkriptAnalysieren, voicemailBackupCheck } from './gpt.dienst';
import { emailMitTemplateSenden, emailSenden } from './email.dienst';
import { superchatKontaktSuchen, superchatKontaktErstellen, superchatTemplateNachrichtSenden, hatLeadPerWhatsAppGeantwortet } from './whatsapp.dienst';
import { integrationKonfigurationLesenMitFallback } from './integrationen.dienst';
import { socketServer } from '../websocket/socket.handler';
import { logger } from '../hilfsfunktionen/logger';
import { anrufQueue, followUpQueue } from '../jobs/queue';
import { anrufPollingStarten } from '../jobs/anruf-polling.job';
import { zeitfensterAktiv, naechsterZeitfensterbeginn } from '../hilfsfunktionen/zeitfenster';
import { istHandynummer } from '../hilfsfunktionen/telefon.formatierung';

interface AnrufZeitslot {
  stunde: number;
  minute: number;
}

type FollowUpGrund =
  | 'verpasst'
  | 'voicemail'
  | 'unerreichbar'
  | 'nichtInteressiert'
  | 'terminBestaetigung'
  | 'rueckruf';

/**
 * Startet die Anruf-Sequenz für einen Lead.
 */
export async function anrufSequenzStarten(leadId: string, kampagneId: string) {
  const kampagne = await prisma.kampagne.findUnique({ where: { id: kampagneId } });
  if (!kampagne) return;

  if (!kampagne.vapiAktiviert) return;

  // Assistant-ID kann entweder in der Kampagne oder in der Kunden-VAPI-Integration stehen
  if (!kampagne.vapiAssistantId) {
    const vapiKonfig = await integrationKonfigurationLesenMitFallback('vapi', kampagne.kundeId);
    if (!vapiKonfig?.assistant_id) {
      logger.warn(`Anruf-Sequenz übersprungen: Keine VAPI-Assistant-ID für Lead ${leadId}`);
      return;
    }
  }

  logger.info(`Anruf-Sequenz gestartet für Lead ${leadId}`);
  await naechstenAnrufPlanen(leadId, kampagneId, 1);
}

/**
 * Plant den nächsten Anrufversuch mit intelligenter Zeitberechnung.
 */
export async function naechstenAnrufPlanen(
  leadId: string,
  kampagneId: string,
  versuchNummer: number
) {
  const kampagne = await prisma.kampagne.findUnique({ where: { id: kampagneId } });
  if (!kampagne) return;

  if (versuchNummer > kampagne.maxAnrufVersuche) {
    // Alle Versuche erschöpft
    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'Nicht erreichbar' },
    });
    await aktivitaetLoggen(leadId, 'anruf_fehlgeschlagen',
      `Alle ${kampagne.maxAnrufVersuche} Anrufversuche erschöpft – Lead nicht erreichbar`);

    // Follow-up "Nicht erreichbar" senden
    await followUpSenden(leadId, kampagneId, kampagne, 'unerreichbar');

    // Team-Benachrichtigung senden
    if (kampagne.benachrichtigungEmail) {
      await teamBenachrichtigungSenden(
        kampagne.benachrichtigungEmail,
        lead,
        'Nicht erreichbar',
        `Alle ${kampagne.maxAnrufVersuche} Anrufversuche erschöpft.`,
        kampagne.kundeId
      );
    }
    return;
  }

  const zeitslots = kampagne.anrufZeitslots as unknown as AnrufZeitslot[];
  const geplantFuer = naechsteAnrufzeitBerechnen(zeitslots);

  const versuch = await prisma.anrufVersuch.create({
    data: {
      leadId,
      kampagneId,
      versuchNummer,
      status: 'geplant',
      geplantFuer,
    },
  });

  // Lead-Feld aktualisieren
  await prisma.lead.update({
    where: { id: leadId },
    data: { naechsterAnrufAm: geplantFuer },
  });

  // BullMQ-Job mit Delay einplanen
  const delay = Math.max(geplantFuer.getTime() - Date.now(), 1000);
  await anrufQueue.add('anruf-durchfuehren', {
    anrufVersuchId: versuch.id,
    leadId,
    kampagneId,
  }, {
    delay,
    jobId: `anruf-${versuch.id}`,
  });

  logger.info(`Anruf #${versuchNummer} geplant für ${geplantFuer.toISOString()} (Lead ${leadId})`);

  // Echtzeit-Event
  const io = socketServer();
  if (io) {
    io.to(`kampagne:${kampagneId}`).emit('anruf:geplant', {
      leadId,
      versuchNummer,
      geplantFuer: geplantFuer.toISOString(),
    });
  }
}

/**
 * Plant einen sofortigen Anruf (5 Sek Delay) — fuer manuelle Tests oder
 * fehlerhaftes Auflegen. Umgeht das Zeitslot-Routing und ruft den
 * Lead unmittelbar an.
 */
export async function sofortigenAnrufPlanen(leadId: string, kampagneId: string, versuchNummer: number) {
  const versuch = await prisma.anrufVersuch.create({
    data: { leadId, kampagneId, versuchNummer, status: 'geplant', geplantFuer: new Date() },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { naechsterAnrufAm: new Date() },
  });

  await anrufQueue.add('anruf-durchfuehren', {
    anrufVersuchId: versuch.id, leadId, kampagneId,
  }, { delay: 5000, jobId: `anruf-sofort-${versuch.id}` });

  logger.info(`Sofortiger Anruf geplant (5s) für Lead ${leadId} – Versuch #${versuchNummer}`);

  const io = socketServer();
  if (io) {
    io.to(`kampagne:${kampagneId}`).emit('anruf:geplant', {
      leadId,
      versuchNummer,
      geplantFuer: new Date().toISOString(),
    });
  }

  return versuch;
}

/**
 * Führt einen geplanten Anruf durch.
 */
export async function anrufDurchfuehren(anrufVersuchId: string) {
  const versuch = await prisma.anrufVersuch.findUnique({
    where: { id: anrufVersuchId },
    include: { lead: true },
  });

  if (!versuch) {
    logger.warn(`AnrufVersuch ${anrufVersuchId} nicht gefunden`);
    return;
  }

  const lead = versuch.lead;

  // Prüfe ob Lead bereits erreicht wurde
  const beendendeStatus = ['Termin gebucht', 'Nicht interessiert', 'Falsche Nummer', 'Nicht erreichbar', 'WhatsApp erhalten'];
  if (beendendeStatus.includes(lead.status)) {
    logger.info(`Lead ${lead.id} hat bereits Status "${lead.status}" – Anruf übersprungen`);
    await prisma.anrufVersuch.update({
      where: { id: anrufVersuchId },
      data: { status: 'abgeschlossen', fehlerNachricht: `Übersprungen: Lead-Status "${lead.status}"` },
    });
    return;
  }

  // Prüfe ob Lead zwischenzeitlich per WhatsApp geantwortet hat
  if (lead.telefon && versuch.versuchNummer >= 1) {
    try {
      const hatGeantwortet = await hatLeadPerWhatsAppGeantwortet(lead.telefon);
      if (hatGeantwortet) {
        logger.info(`Lead ${lead.id} hat per WhatsApp geantwortet – Anruf übersprungen`);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: 'WhatsApp erhalten' },
        });
        await prisma.anrufVersuch.update({
          where: { id: anrufVersuchId },
          data: { status: 'abgeschlossen', fehlerNachricht: 'Übersprungen: Lead hat per WhatsApp geantwortet' },
        });
        return;
      }
    } catch {
      // Check fehlgeschlagen → weiter mit Anruf
    }
  }

  const kampagne = await prisma.kampagne.findUnique({ where: { id: versuch.kampagneId } });
  if (!kampagne) return;

  // Status + Lead-Felder aktualisieren
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: 'Anruf läuft',
      anrufVersucheAnzahl: { increment: 1 },
      letzterAnrufAm: new Date(),
    },
  });

  await prisma.anrufVersuch.update({
    where: { id: anrufVersuchId },
    data: { status: 'laeuft', gestartetAm: new Date() },
  });

  await aktivitaetLoggen(lead.id, 'anruf_gestartet',
    `Anrufversuch #${versuch.versuchNummer} gestartet`);

  try {
    // Bisherige Gesprächszusammenfassungen laden (ab Versuch #2)
    let assistantOverrides: Record<string, unknown> | undefined;
    if (versuch.versuchNummer > 1) {
      const bisherigeVersuche = await prisma.anrufVersuch.findMany({
        where: { leadId: lead.id, status: 'abgeschlossen', gptAnalyse: { not: null } },
        orderBy: { versuchNummer: 'asc' },
        select: { versuchNummer: true, gptAnalyse: true },
      });

      if (bisherigeVersuche.length > 0) {
        const gespraechsHistorie = bisherigeVersuche
          .map((v) => {
            try {
              const json = JSON.parse(v.gptAnalyse!) as { summary?: string };
              return `Versuch #${v.versuchNummer}: ${json.summary || v.gptAnalyse}`;
            } catch {
              return `Versuch #${v.versuchNummer}: ${v.gptAnalyse}`;
            }
          })
          .join('\n');

        assistantOverrides = {
          model: {
            messages: [{
              role: 'system',
              content: `\n\n# Zusammenfassung der bisherigen Gespräche:\n${gespraechsHistorie}`,
            }],
          },
        };
      }
    }

    // Lead-Daten für den Prompt zusammenstellen
    const leadFelddaten = await prisma.leadFelddatum.findMany({
      where: { leadId: lead.id },
      include: { feld: { select: { bezeichnung: true } } },
    });

    const leadInfo = [
      `vorname: ${lead.vorname || '—'}`,
      `nachname: ${lead.nachname || '—'}`,
      `email: ${lead.email || '—'}`,
      `telefon: ${lead.telefon || '—'}`,
      ...leadFelddaten.map((f) => `${f.feld.bezeichnung}: ${f.wert || '—'}`),
    ].join(', ');

    const leadInfoMessage = {
      role: 'system',
      content: `\n\n# Lead Information:\n${leadInfo}`,
    };

    // Sprach-Anweisung + Datums-Kontext werden DIREKT in den vapiPrompt integriert
    // (nicht als separate System-Messages, weil GPT-4o den Haupt-Prompt staerker beachtet)
    const sprachUndDatumBlock = `

# SPRACH-REGELN (IMMER EINHALTEN)

Du sprichst AUSSCHLIESSLICH Deutsch. Niemals Englisch, auch nicht einzelne Woerter.
- Datumsangaben nennst du auf Deutsch ausgeschrieben (z.B. "Donnerstag, der fuenfzehnte April")
- NIEMALS englische Datumsformate ("April fifteenth", "March 15th")
- Uhrzeiten auf Deutsch ("vierzehn Uhr dreissig" oder "halb drei am Nachmittag")
- Wochentage, Monate und Zahlen IMMER auf Deutsch
- Keine englischen Lehnwoerter wenn es ein deutsches Wort gibt ("Termin" statt "Appointment")

${datumsKontextErstellen()}`;

    // Kampagnen-VAPI-Prompt mit Sprach-/Datums-Block kombinieren
    const kombinierterPrompt = (kampagne.vapiPrompt || '') + sprachUndDatumBlock;

    const vapiPromptMessage = {
      role: 'system',
      content: kombinierterPrompt,
    };

    // Bestehende Messages (Gesprächshistorie) + kombinierter Prompt + Lead-Daten zusammenführen
    const bisherMessages = (assistantOverrides?.model as Record<string, unknown> | undefined)?.messages as Array<Record<string, string>> | undefined;
    const alleMessages = [
      vapiPromptMessage,
      ...(bisherMessages || []),
      leadInfoMessage,
    ];

    if (!assistantOverrides) assistantOverrides = {};
    assistantOverrides = {
      ...assistantOverrides,
      model: {
        ...(assistantOverrides.model as Record<string, unknown> | undefined),
        messages: alleMessages,
      },
    };

    // VAPI-Tools + Server-URL hinzufügen
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    if (apiBaseUrl.includes('localhost')) {
      logger.warn('API_BASE_URL enthält "localhost" – VAPI kann Tools und Webhooks nicht erreichen. Bitte eine öffentliche URL setzen.');
    }
    const vapiTools = [
      {
        type: 'function',
        function: {
          name: 'kalenderPruefen',
          strict: true,
          description: 'Prüft die Kalender-Verfügbarkeit zum gewünschten Zeitpunkt.',
          parameters: {
            type: 'object',
            required: ['gewuenschteZeit'],
            properties: { gewuenschteZeit: { type: 'string', description: 'Gewünschte Zeit im ISO-Format YYYY-MM-DDTHH:MM:SS, z.B. 2026-04-15T14:30:00 für den fünfzehnten April um halb drei nachmittags. Nutze IMMER das aktuelle Jahr aus dem Datums-Kontext.' } },
          },
        },
        messages: [{ type: 'request-start', content: 'Eine Sekunde bitte, ich schaue gerne kurz nach, ob ein Termin frei ist.', blocking: false }],
      },
      {
        type: 'function',
        function: {
          name: 'terminBuchen',
          strict: true,
          description: 'Bucht einen Termin zum bestätigten Zeitpunkt.',
          parameters: {
            type: 'object',
            required: ['gewuenschteZeit', 'telefonnummer', 'vorname', 'nachname'],
            properties: {
              gewuenschteZeit: { type: 'string', description: 'Bestätigte Zeit im ISO-Format YYYY-MM-DDTHH:MM:SS, z.B. 2026-04-15T14:30:00. Nutze IMMER das aktuelle Jahr aus dem Datums-Kontext.' },
              telefonnummer: { type: 'string', description: 'Telefonnummer des Leads' },
              vorname: { type: 'string', description: 'Vorname des Leads' },
              nachname: { type: 'string', description: 'Nachname des Leads' },
            },
          },
        },
        messages: [{ type: 'request-start', content: 'Ich stelle den Termin direkt ein.', blocking: false }],
      },
      {
        type: 'function',
        function: {
          name: 'rueckrufPlanen',
          strict: true,
          description: 'Plant einen Rückruf zu einem späteren Zeitpunkt.',
          parameters: {
            type: 'object',
            required: ['telefonnummer', 'rueckrufZeit'],
            properties: {
              telefonnummer: { type: 'string', description: 'Telefonnummer des Leads' },
              rueckrufZeit: { type: 'string', description: 'Gewünschte Rückrufzeit im ISO 8601 Format' },
            },
          },
        },
        messages: [{ type: 'request-start', blocking: false }],
        async: true,
      },
      {
        type: 'function',
        function: {
          name: 'leadDatenKorrigieren',
          strict: true,
          description: 'Korrigiert Lead-Daten wenn der Angerufene eine Angabe korrigiert.',
          parameters: {
            type: 'object',
            required: ['telefonnummer', 'datenTyp', 'neuerWert'],
            properties: {
              telefonnummer: { type: 'string', description: 'Telefonnummer des Leads' },
              datenTyp: { type: 'string', description: 'Art der Information: email, telefon, vorname, nachname' },
              neuerWert: { type: 'string', description: 'Der korrigierte Wert' },
            },
          },
        },
        messages: [{ type: 'request-start', blocking: false }],
        async: true,
      },
    ];

    // firstMessage mit Lead-Daten befüllen
    let firstMessage: string | undefined;
    if (kampagne.vapiErsteBotschaft) {
      firstMessage = kampagne.vapiErsteBotschaft
        .replace(/\{\{vorname\}\}/g, lead.vorname || '')
        .replace(/\{\{nachname\}\}/g, lead.nachname || '');
    }

    assistantOverrides = {
      ...assistantOverrides,
      ...(firstMessage ? { firstMessage } : {}),
      firstMessageMode: 'assistant-speaks-first',
      server: { url: `${apiBaseUrl}/api/v1/webhooks/vapi/tools`, timeoutSeconds: 20 },
      model: {
        ...(assistantOverrides?.model as Record<string, unknown> | undefined),
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        tools: vapiTools,
      },
      // Stimme (ElevenLabs)
      voice: {
        provider: '11labs',
        voiceId: kampagne.vapiVoiceId || 'EXAVITQu4vr4xnSDxMaL',
        model: 'eleven_turbo_v2_5',
        stability: 0.5,
        similarityBoost: 0.75,
        useSpeakerBoost: false,
        speed: 1.05,
        style: 0.1,
        optimizeStreamingLatency: 2,
        inputPunctuationBoundaries: ['，', ';'],
        language: 'de',
      },
      // VAPI Assistant-Konfiguration
      endCallFunctionEnabled: true,
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 300,
      backgroundDenoisingEnabled: true,
      voicemailDetection: { provider: 'twilio' },
      transcriber: { model: 'nova-3', language: 'de', provider: 'deepgram' },
      endCallPhrases: ['Auf Wiederhören.', 'Schönen Tag noch.', 'Tschüss.'],
      ...(kampagne.vapiVoicemailNachricht ? { voicemailMessage: kampagne.vapiVoicemailNachricht } : {}),
    };

    // VAPI-Konfiguration ermitteln: erst Kunden-Integration, dann Kampagnen-Felder
    // (so kann ein Kunde seinen eigenen VAPI-Assistant + Phone-Number nutzen)
    const vapiKonfig = await integrationKonfigurationLesenMitFallback('vapi', kampagne.kundeId);
    const assistantId = vapiKonfig?.assistant_id || kampagne.vapiAssistantId!;
    const phoneNumberId = vapiKonfig?.phone_number_id || kampagne.vapiPhoneNumberId!;

    if (!assistantId || !phoneNumberId) {
      throw new Error(
        'VAPI Assistant-ID oder Phone-Number-ID fehlt. Bitte in der Kunden-Integration oder Kampagne konfigurieren.'
      );
    }

    // VAPI-Anruf starten
    const kundeName = [lead.vorname, lead.nachname].filter(Boolean).join(' ');
    const callId = await vapiAnrufStarten(
      lead.telefon!,
      assistantId,
      phoneNumberId,
      kundeName,
      {
        leadId: lead.id,
        kampagneId: versuch.kampagneId,
        kundeId: kampagne.kundeId || '',
        versuchNr: String(versuch.versuchNummer),
      },
      assistantOverrides,
      kampagne.kundeId
    );

    // Call-ID speichern (Lead + AnrufVersuch)
    await Promise.all([
      prisma.anrufVersuch.update({
        where: { id: anrufVersuchId },
        data: { vapiCallId: callId },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: { vapiCallId: callId },
      }),
    ]);

    logger.info(`VAPI Anruf gestartet: Call ${callId} für Lead ${lead.id}`);

    // Polling starten – fragt VAPI alle 10 Sek ab bis der Anruf beendet ist
    await anrufPollingStarten(callId, anrufVersuchId, kampagne.kundeId || undefined);

    // Echtzeit-Event
    const io = socketServer();
    if (io) {
      io.to(`kampagne:${versuch.kampagneId}`).emit('anruf:gestartet', {
        leadId: lead.id,
        versuchNummer: versuch.versuchNummer,
        callId,
      });
    }

    // WICHTIG: Job ist fertig – VAPI Webhook liefert das Ergebnis async
  } catch (fehler) {
    logger.error(`Anruf fehlgeschlagen für Lead ${lead.id}:`, { error: fehler });

    await prisma.anrufVersuch.update({
      where: { id: anrufVersuchId },
      data: {
        status: 'fehler',
        fehlerNachricht: fehler instanceof Error ? fehler.message : String(fehler),
      },
    });

    await aktivitaetLoggen(lead.id, 'anruf_fehlgeschlagen',
      `Anrufversuch #${versuch.versuchNummer} fehlgeschlagen: ${fehler instanceof Error ? fehler.message : 'Unbekannter Fehler'}`);

    // Nächsten Versuch planen trotz Fehler
    await naechstenAnrufPlanen(lead.id, versuch.kampagneId, versuch.versuchNummer + 1);
  }
}

/**
 * Verarbeitet das Ergebnis eines VAPI-Anrufs (vom Webhook aufgerufen).
 */
export async function anrufErgebnisVerarbeiten(
  vapiCallId: string,
  transkript: string,
  endedReason: string,
  dauer?: number
) {
  const versuch = await prisma.anrufVersuch.findUnique({
    where: { vapiCallId },
    include: { lead: true },
  });

  if (!versuch) {
    logger.warn(`AnrufVersuch mit vapiCallId ${vapiCallId} nicht gefunden`);
    return;
  }

  const kampagne = await prisma.kampagne.findUnique({ where: { id: versuch.kampagneId } });
  if (!kampagne) return;

  // 1. Technische Fehler → direkt Retry planen, KEINE GPT-Analyse
  const technischeFehler = [
    'call-start-error-neither-assistant-nor-server-set',
    'assistant-error',
    'worker-shutdown',
    'assistant-join-timed-out',
    'assistant-request-returned-error',
  ];

  if (technischeFehler.includes(endedReason)) {
    logger.warn(`Technischer Fehler bei Anruf ${vapiCallId}: ${endedReason}`);

    await prisma.anrufVersuch.update({
      where: { id: versuch.id },
      data: {
        status: 'fehler',
        beendetAm: new Date(),
        dauerSekunden: dauer,
        fehlerNachricht: `Technischer Fehler: ${endedReason}`,
      },
    });

    await prisma.lead.update({
      where: { id: versuch.leadId },
      data: { vapiCallId: null },
    });

    await aktivitaetLoggen(versuch.leadId, 'anruf_fehlgeschlagen',
      `Anruf #${versuch.versuchNummer}: Technischer Fehler (${endedReason}) – nächster Versuch wird geplant`);

    await naechstenAnrufPlanen(versuch.leadId, versuch.kampagneId, versuch.versuchNummer + 1);
    return;
  }

  // 2. Voicemail-Backup-Check: Wenn VAPI "voicemail" meldet aber Transkript vorhanden
  if (endedReason === 'voicemail' && transkript && transkript.trim().length > 20) {
    logger.info(`Voicemail-Backup-Check für Anruf ${vapiCallId}`);
    const backupErgebnis = await voicemailBackupCheck(transkript);

    if (backupErgebnis === 'voicemail') {
      // Bestätigt als Voicemail → Retry planen + Follow-up
      await prisma.anrufVersuch.update({
        where: { id: versuch.id },
        data: {
          status: 'abgeschlossen',
          beendetAm: new Date(),
          dauerSekunden: dauer,
          ergebnis: 'voicemail',
          transkript,
          gptAnalyse: JSON.stringify({ verdict: 'voicemail', backupCheck: true }),
        },
      });

      await prisma.lead.update({
        where: { id: versuch.leadId },
        data: {
          status: 'Voicemail',
          gptZusammenfassung: 'Voicemail erreicht (Backup-Check bestätigt).',
          gptVerdict: 'voicemail',
          vapiCallId: null,
        },
      });

      await prisma.leadStatusHistorie.create({
        data: {
          leadId: versuch.leadId,
          alterStatus: versuch.lead.status,
          neuerStatus: 'Voicemail',
          grund: `VAPI Anruf #${versuch.versuchNummer}: Voicemail (Backup bestätigt)`,
        },
      });

      await aktivitaetLoggen(versuch.leadId, 'anruf_abgeschlossen',
        `Anruf #${versuch.versuchNummer}: Voicemail (Backup-Check bestätigt) – nächster Versuch wird geplant`);

      // Follow-up Mail senden wenn noch nicht fuer diesen Lead geschehen
      const bereitsVoicemailGesendet = await prisma.leadAktivitaet.findFirst({
        where: { leadId: versuch.leadId, typ: 'email_gesendet', beschreibung: { contains: 'Voicemail' } },
      });
      if (!bereitsVoicemailGesendet) {
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, 'voicemail');
      } else {
        logger.info(`Follow-up "voicemail" bereits gesendet — Duplikat uebersprungen (Lead ${versuch.leadId})`);
      }

      await naechstenAnrufPlanen(versuch.leadId, versuch.kampagneId, versuch.versuchNummer + 1);

      emitAnrufErgebnis(versuch.kampagneId, versuch.leadId, versuch.versuchNummer, 'voicemail');
      return;
    }

    // backupErgebnis === 'call' → War doch ein echtes Gespräch, weiter mit GPT-Analyse
    logger.info(`Voicemail-Backup-Check: War doch ein Gespräch – normale Analyse für ${vapiCallId}`);
  }

  // 3. Normale GPT-Analyse
  const analyse = await transkriptAnalysieren(transkript, endedReason, kampagne.vapiPrompt || undefined);

  // Versuch aktualisieren
  await prisma.anrufVersuch.update({
    where: { id: versuch.id },
    data: {
      status: 'abgeschlossen',
      beendetAm: new Date(),
      dauerSekunden: dauer,
      ergebnis: analyse.ergebnis,
      transkript,
      gptAnalyse: JSON.stringify({ summary: analyse.zusammenfassung, verdict: analyse.verdict }),
    },
  });

  logger.info(`Anruf ${vapiCallId} Ergebnis: ${analyse.verdict} → ${analyse.ergebnis} (Versuch #${versuch.versuchNummer})`);

  // Lead-Status basierend auf Ergebnis
  // WICHTIG: "interessiert" = Termin wurde TATSÄCHLICH gebucht (via terminBuchen Tool)
  // "rueckruf_geplant" = Kunde hat Interesse aber Termin steht noch aus → Follow-up
  const statusMap: Record<string, string> = {
    interessiert: 'Termin gebucht',
    rueckruf_geplant: 'Follow-up',
    nicht_interessiert: 'Nicht interessiert',
    falsche_nummer: 'Falsche Nummer',
    voicemail: 'Voicemail',
    hung_up: 'Hung Up',
    disconnected: 'Disconnected',
  };

  const neuerStatus = statusMap[analyse.ergebnis];

  // GPT-Felder + vapiCallId auf Lead aktualisieren
  await prisma.lead.update({
    where: { id: versuch.leadId },
    data: {
      gptZusammenfassung: analyse.zusammenfassung || null,
      gptVerdict: analyse.verdict,
      vapiCallId: null,
      ...(neuerStatus ? { status: neuerStatus } : {}),
    },
  });

  if (neuerStatus) {
    await prisma.leadStatusHistorie.create({
      data: {
        leadId: versuch.leadId,
        alterStatus: versuch.lead.status,
        neuerStatus,
        grund: `VAPI Anruf #${versuch.versuchNummer}: ${analyse.verdict}`,
      },
    });
    await aktivitaetLoggen(versuch.leadId, 'anruf_abgeschlossen',
      `Anruf #${versuch.versuchNummer}: ${analyse.verdict} → Status "${neuerStatus}"`);

    // Bei Endstatus: passende Follow-up-Mail senden + Team-Benachrichtigung + Sequenz beenden
    if (['interessiert', 'nicht_interessiert', 'falsche_nummer'].includes(analyse.ergebnis)) {
      // Status-spezifische Follow-up-Mail
      if (analyse.ergebnis === 'interessiert') {
        // Termin gebucht → Bestaetigungs-Mail mit Calendly-Link + Zusammenfassung
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, 'terminBestaetigung');
      } else if (analyse.ergebnis === 'nicht_interessiert') {
        // Nicht interessiert → freundliche Abschluss-Mail
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, 'nichtInteressiert');
      }
      // Bei "falsche_nummer" keine Mail an den Lead — die Adresse koennte falsch sein

      // Team-Benachrichtigung senden
      if (kampagne.benachrichtigungEmail) {
        await teamBenachrichtigungSenden(
          kampagne.benachrichtigungEmail,
          versuch.lead,
          neuerStatus,
          analyse.zusammenfassung,
          kampagne.kundeId
        );
      }
      emitAnrufErgebnis(versuch.kampagneId, versuch.leadId, versuch.versuchNummer, analyse.ergebnis);
      return;
    }
  }

  // Fehlerhaftes Auflegen: Assistant hat aufgelegt obwohl Gespräch lief → sofortiger Retry
  const assistantAufgelegt = ['assistant-ended-call', 'assistant-ended-call-after-message-spoken'];
  if (assistantAufgelegt.includes(endedReason) && ['hung_up', 'disconnected'].includes(analyse.ergebnis) && transkript && transkript.length > 50) {
    logger.info(`Fehlerhaftes Auflegen erkannt bei Anruf ${vapiCallId} – sofortiger Rückruf`);
    await aktivitaetLoggen(versuch.leadId, 'anruf_fehlgeschlagen',
      `Anruf #${versuch.versuchNummer}: Fehlerhaftes Auflegen (${endedReason}) – sofortiger Rückruf`);
    await sofortigenAnrufPlanen(versuch.leadId, versuch.kampagneId, versuch.versuchNummer + 1);
    emitAnrufErgebnis(versuch.kampagneId, versuch.leadId, versuch.versuchNummer, 'fehlerhaftes_auflegen');
    return;
  }

  // Bei voicemail/rueckruf/nicht_abgenommen/aufgelegt/hung_up/disconnected: nächsten Versuch planen
  const retryErgebnisse = ['voicemail', 'rueckruf_geplant', 'nicht_abgenommen', 'aufgelegt', 'hung_up', 'disconnected'];
  if (retryErgebnisse.includes(analyse.ergebnis)) {
    await aktivitaetLoggen(versuch.leadId, 'anruf_abgeschlossen',
      `Anruf #${versuch.versuchNummer}: ${analyse.verdict} – nächster Versuch wird geplant`);

    // Follow-up E-Mail senden: beim ERSTEN Mal dass dieses Ergebnis auftritt.
    // Pruefen ob fuer diesen Lead schon eine Follow-up-Mail zu diesem Grund gesendet wurde,
    // damit nicht nach jedem Retry eine Duplikat-Mail rausgeht.
    const bereitsGesendet = await prisma.leadAktivitaet.findFirst({
      where: {
        leadId: versuch.leadId,
        typ: 'email_gesendet',
        beschreibung: { contains: analyse.ergebnis === 'voicemail' ? 'Voicemail' : analyse.ergebnis === 'rueckruf_geplant' ? 'Rueckruf' : 'Verpasster Anruf' },
      },
    });
    if (!bereitsGesendet) {
      if (analyse.ergebnis === 'rueckruf_geplant') {
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, 'rueckruf');
      } else {
        const followUpGrund: FollowUpGrund = analyse.ergebnis === 'voicemail' ? 'voicemail' : 'verpasst';
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, followUpGrund);
      }
    } else {
      logger.info(`Follow-up fuer "${analyse.ergebnis}" bereits gesendet — Duplikat uebersprungen (Lead ${versuch.leadId})`);
    }

    // Nächsten Versuch planen
    await naechstenAnrufPlanen(versuch.leadId, versuch.kampagneId, versuch.versuchNummer + 1);
  }

  emitAnrufErgebnis(versuch.kampagneId, versuch.leadId, versuch.versuchNummer, analyse.ergebnis);
}

/**
 * Sendet Echtzeit-Event für Anruf-Ergebnis.
 */
function emitAnrufErgebnis(kampagneId: string, leadId: string, versuchNummer: number, ergebnis: string) {
  const io = socketServer();
  if (io) {
    io.to(`kampagne:${kampagneId}`).emit('anruf:ergebnis', {
      leadId,
      versuchNummer,
      ergebnis,
    });
  }
}

/**
 * Sendet Follow-up E-Mail und WhatsApp. Prüft Zeitfenster und verzögert ggf.
 */
async function followUpSenden(
  leadId: string,
  kampagneId: string,
  kampagne: KampagneFuerFollowUp,
  grund: FollowUpGrund
) {
  // Zeitfenster-Prüfung (Mo-Fr 09:00-20:00)
  if (!zeitfensterAktiv()) {
    const naechsterZeitpunkt = naechsterZeitfensterbeginn();
    const delay = Math.max(naechsterZeitpunkt.getTime() - Date.now(), 1000);
    await followUpQueue.add('follow-up-senden', { leadId, kampagneId, grund }, {
      delay,
      jobId: `followup-${leadId}-${grund}-${Date.now()}`,
    });
    logger.info(`Follow-up "${grund}" verzögert bis ${naechsterZeitpunkt.toISOString()} für Lead ${leadId}`);
    return;
  }

  await followUpDirektSenden(leadId, kampagne, grund);
}

/**
 * Gemeinsamer Typ fuer alle Stellen die Follow-ups triggern.
 */
type KampagneFuerFollowUp = {
  emailAktiviert: boolean;
  whatsappAktiviert: boolean;
  emailTemplateVerpasst: string | null;
  emailTemplateVoicemail: string | null;
  emailTemplateUnerreichbar: string | null;
  emailTemplateTerminBestaetigung: string | null;
  emailTemplateRueckruf: string | null;
  emailTemplateNichtInteressiert: string | null;
  whatsappTemplateVerpasst: string | null;
  whatsappTemplateUnerreichbar: string | null;
  whatsappTemplateNichtInteressiert: string | null;
  whatsappKanalId: string | null;
};

/**
 * Sendet Follow-up direkt (ohne Zeitfenster-Prüfung). Wird vom Worker aufgerufen.
 */
export async function followUpDirektSenden(
  leadId: string,
  kampagne: KampagneFuerFollowUp,
  grund: FollowUpGrund
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      kampagne: { select: { name: true, kundeId: true, calendlyLink: true } },
      zugewiesener: { select: { vorname: true, nachname: true } },
      felddaten: { include: { feld: { select: { feldname: true } } } },
    },
  });

  if (!lead) return;

  // Template-IDs nach Grund auswählen — jeder Grund hat sein eigenes Template
  // mit Fallback auf das Unerreichbar-Template falls das spezifische fehlt
  const emailTemplateId: string | null = {
    verpasst: kampagne.emailTemplateVerpasst,
    voicemail: kampagne.emailTemplateVoicemail,
    unerreichbar: kampagne.emailTemplateUnerreichbar,
    nichtInteressiert: kampagne.emailTemplateNichtInteressiert || kampagne.emailTemplateUnerreichbar,
    terminBestaetigung: kampagne.emailTemplateTerminBestaetigung,
    rueckruf: kampagne.emailTemplateRueckruf || kampagne.emailTemplateVerpasst,
  }[grund];

  const whatsappTemplateId: string | null = {
    verpasst: kampagne.whatsappTemplateVerpasst,
    voicemail: null,
    unerreichbar: kampagne.whatsappTemplateUnerreichbar,
    nichtInteressiert: kampagne.whatsappTemplateNichtInteressiert,
    terminBestaetigung: null,
    rueckruf: null,
  }[grund];

  const grundBezeichnung: Record<FollowUpGrund, string> = {
    verpasst: 'Verpasster Anruf',
    voicemail: 'Voicemail',
    unerreichbar: 'Nicht erreichbar',
    nichtInteressiert: 'Nicht interessiert',
    terminBestaetigung: 'Termin-Bestaetigung',
    rueckruf: 'Rueckruf-Bestaetigung',
  };

  // E-Mail senden (wenn aktiviert + Template vorhanden) – nutzt SMTP des Kunden
  // Diagnose-Logging: stille Skips sind frueher unbemerkt geblieben, jetzt explizit
  if (!kampagne.emailAktiviert) {
    logger.info(`Follow-up "${grund}" uebersprungen: emailAktiviert=false (Lead ${leadId})`);
  } else if (!lead.email) {
    logger.info(`Follow-up "${grund}" uebersprungen: Lead hat keine E-Mail-Adresse (Lead ${leadId})`);
  } else if (!emailTemplateId) {
    logger.warn(`Follow-up "${grund}" uebersprungen: kein E-Mail-Template fuer diesen Grund hinterlegt (Kampagne pruefen, Lead ${leadId})`);
  } else {
    try {
      await emailMitTemplateSenden(emailTemplateId, lead, undefined, lead.kampagne?.kundeId || null);
      await aktivitaetLoggen(leadId, 'email_gesendet',
        `Follow-up E-Mail gesendet: ${grundBezeichnung[grund]}`);
      logger.info(`Follow-up E-Mail "${grund}" erfolgreich gesendet an ${lead.email} (Lead ${leadId})`);
    } catch (fehler) {
      logger.error('Follow-up E-Mail fehlgeschlagen:', { leadId, grund, error: fehler });
    }
  }

  // WhatsApp senden (wenn aktiviert + Template + Kanal + Handynummer)
  if (kampagne.whatsappAktiviert && whatsappTemplateId && kampagne.whatsappKanalId && lead.telefon && istHandynummer(lead.telefon)) {
    try {
      const superchatKonfig = await integrationKonfigurationLesenMitFallback('superchat', lead.kampagne?.kundeId || null);
      if (superchatKonfig?.api_schluessel) {
        const basisUrl = superchatKonfig.basis_url || 'https://api.superchat.de';
        let kontakt = await superchatKontaktSuchen(lead.telefon, superchatKonfig.api_schluessel, basisUrl);

        if (!kontakt) {
          kontakt = await superchatKontaktErstellen(
            { telefon: lead.telefon, vorname: lead.vorname || undefined, nachname: lead.nachname || undefined },
            superchatKonfig.api_schluessel,
            basisUrl
          );
        }

        if (kontakt) {
          await superchatTemplateNachrichtSenden(
            kontakt.id,
            kampagne.whatsappKanalId,
            whatsappTemplateId,
            [{ name: 'vorname', wert: lead.vorname || '' }],
            superchatKonfig.api_schluessel,
            basisUrl
          );
          await aktivitaetLoggen(leadId, 'whatsapp_gesendet',
            `Follow-up WhatsApp gesendet: ${grundBezeichnung[grund]}`);
        }
      }
    } catch (fehler) {
      logger.error('Follow-up WhatsApp fehlgeschlagen:', { leadId, grund, error: fehler });
    }
  }
}

/**
 * Liefert die aktuellen Berlin-Zeit-Komponenten unabhängig von der Server-Zeitzone.
 */
function berlinZeitKomponenten(jetzt: Date): {
  jahr: number;
  monat: number; // 0-basiert
  tag: number;
  stunde: number;
  minute: number;
  wochentag: number; // 0=So .. 6=Sa
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const teile = Object.fromEntries(
    fmt.formatToParts(jetzt).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const wochentagMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    jahr: parseInt(teile.year, 10),
    monat: parseInt(teile.month, 10) - 1,
    tag: parseInt(teile.day, 10),
    stunde: parseInt(teile.hour === '24' ? '0' : teile.hour, 10),
    minute: parseInt(teile.minute, 10),
    wochentag: wochentagMap[teile.weekday] ?? 0,
  };
}

/**
 * Konstruiert ein Date-Objekt, das einer bestimmten Wanduhr-Zeit in Berlin entspricht.
 * Behandelt DST-Übergänge korrekt durch Iterationsschritt.
 */
function berlinDatumErzeugen(jahr: number, monat: number, tag: number, stunde: number, minute: number): Date {
  // Erster Versuch: interpretiere Berlin-Wanduhr als wäre es UTC
  let utcKandidat = new Date(Date.UTC(jahr, monat, tag, stunde, minute, 0));
  // Zweimal iterieren reicht für DST: bestimme den tatsächlichen Berlin-Offset und korrigiere
  for (let i = 0; i < 2; i++) {
    const sieht = berlinZeitKomponenten(utcKandidat);
    const sollMinuten = stunde * 60 + minute;
    const istMinuten = sieht.stunde * 60 + sieht.minute;
    const diffMinuten = sollMinuten - istMinuten;
    if (diffMinuten === 0) break;
    utcKandidat = new Date(utcKandidat.getTime() + diffMinuten * 60 * 1000);
  }
  return utcKandidat;
}

/**
 * Berechnet die nächste Anrufzeit basierend auf Zeitslots.
 * Alle Berechnungen erfolgen in Europe/Berlin und sind unabhängig von der Server-Zeitzone.
 */
function naechsteAnrufzeitBerechnen(zeitslots?: AnrufZeitslot[]): Date {
  const jetzt = new Date();
  const slots = zeitslots?.length ? zeitslots : [
    { stunde: 9, minute: 0 },
    { stunde: 12, minute: 30 },
    { stunde: 17, minute: 0 },
    { stunde: 18, minute: 0 },
    { stunde: 19, minute: 0 },
  ];
  const verzoegerung = 10;

  const berlin = berlinZeitKomponenten(jetzt);
  const aktuelleMinuten = berlin.stunde * 60 + berlin.minute;

  // Hilfsfunktion: Slot an einem bestimmten Berlin-Tag (relativ zum heutigen) erzeugen
  const slotAnTag = (tageVerschiebung: number, slot: AnrufZeitslot): Date => {
    // Tag-Verschiebung über UTC-Datum, dann zurück in Berlin-Komponenten
    const verschoben = new Date(Date.UTC(berlin.jahr, berlin.monat, berlin.tag + tageVerschiebung));
    const verschobenKomp = berlinZeitKomponenten(verschoben);
    return berlinDatumErzeugen(
      verschobenKomp.jahr,
      verschobenKomp.monat,
      verschobenKomp.tag,
      slot.stunde,
      slot.minute,
    );
  };

  // Wochenende → Montag erste Zeit
  if (berlin.wochentag === 0 || berlin.wochentag === 6) {
    const tageAbstand = berlin.wochentag === 0 ? 1 : 2;
    return zufallsVerzoegerungAnwenden(slotAnTag(tageAbstand, slots[0]), verzoegerung);
  }

  // Nach 21:00 → morgen erste Zeit
  if (aktuelleMinuten >= 21 * 60) {
    return zufallsVerzoegerungAnwenden(slotAnTag(1, slots[0]), verzoegerung);
  }

  // Vor 09:00 → heute erste Zeit
  if (aktuelleMinuten < 9 * 60) {
    return zufallsVerzoegerungAnwenden(slotAnTag(0, slots[0]), verzoegerung);
  }

  // Nächste verfügbare Anrufzeit heute finden
  for (const slot of slots) {
    const slotMinuten = slot.stunde * 60 + slot.minute;
    if (slotMinuten > aktuelleMinuten) {
      return zufallsVerzoegerungAnwenden(slotAnTag(0, slot), verzoegerung);
    }
  }

  // Alle Zeiten heute vorbei → morgen erste Zeit
  return zufallsVerzoegerungAnwenden(slotAnTag(1, slots[0]), verzoegerung);
}

/**
 * Fügt eine zufällige Verzögerung von ±X Minuten hinzu.
 */
function zufallsVerzoegerungAnwenden(datum: Date, maxMinuten: number): Date {
  const zufall = Math.floor(Math.random() * maxMinuten * 2) - maxMinuten;
  const ergebnis = new Date(datum.getTime() + zufall * 60 * 1000);
  return ergebnis;
}

async function aktivitaetLoggen(
  leadId: string,
  typ: 'anruf_gestartet' | 'anruf_abgeschlossen' | 'anruf_fehlgeschlagen' | 'email_gesendet' | 'whatsapp_gesendet',
  beschreibung: string
) {
  await prisma.leadAktivitaet.create({
    data: { leadId, typ, beschreibung },
  });
}

/**
 * Sendet eine Team-Benachrichtigungs-Email bei Lead-Endstatus.
 * Nutzt SMTP des Kunden falls konfiguriert, sonst globalen Fallback.
 */
async function teamBenachrichtigungSenden(
  empfaengerEmail: string,
  lead: { vorname: string | null; nachname: string | null; email: string | null; telefon: string | null; anrufVersucheAnzahl: number },
  neuerStatus: string,
  zusammenfassung?: string | null,
  kundeId?: string | null
) {
  const leadName = [lead.vorname, lead.nachname].filter(Boolean).join(' ') || 'Unbekannt';

  try {
    await emailSenden({
      an: empfaengerEmail,
      kundeId,
      betreff: `LeadFlow: ${leadName} – ${neuerStatus}`,
      html: `
        <div style="font-family: 'Manrope', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2b4c;">Lead-Status Update</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Name</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${leadName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">E-Mail</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${lead.email || '—'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Telefon</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${lead.telefon || '—'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Status</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #ff8049; font-weight: 600;">${neuerStatus}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Anrufversuche</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${lead.anrufVersucheAnzahl}</td></tr>
          </table>
          ${zusammenfassung ? `<div style="background: #f5f7fa; padding: 16px; border-radius: 8px; margin-top: 16px;"><h3 style="margin: 0 0 8px; color: #1a2b4c;">KI-Zusammenfassung</h3><p style="margin: 0; color: #3f4e65;">${zusammenfassung}</p></div>` : ''}
        </div>
      `,
    });
    logger.info(`Team-Benachrichtigung gesendet an ${empfaengerEmail}: ${leadName} – ${neuerStatus}`);
  } catch (fehler) {
    logger.error('Team-Benachrichtigung fehlgeschlagen:', { empfaengerEmail, fehler });
  }
}

/**
 * Erzeugt einen ausfuehrlichen Datums-Kontext fuer das LLM, damit es
 * relative Datumsangaben ("morgen", "naechste Woche") in konkrete Daten
 * aufloesen kann ohne zu halluzinieren. Alles in Berlin-Zeit.
 */
function datumsKontextErstellen(): string {
  const wochentage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  const jetzt = new Date();
  const heute = berlinZeitKomponenten(jetzt);

  // Hilfsfunktion: Datum X Tage nach heute formatieren
  const tagOffset = (offset: number): { wochentag: string; iso: string; deutsch: string } => {
    const d = new Date(Date.UTC(heute.jahr, heute.monat, heute.tag + offset));
    const k = berlinZeitKomponenten(d);
    return {
      wochentag: wochentage[k.wochentag],
      iso: `${k.jahr}-${String(k.monat + 1).padStart(2, '0')}-${String(k.tag).padStart(2, '0')}`,
      deutsch: `${wochentage[k.wochentag]}, der ${k.tag}. ${monate[k.monat]} ${k.jahr}`,
    };
  };

  // Berechne "naechster Montag", "naechster Dienstag", ... immer in der NAECHSTEN Woche (>= 7 Tage entfernt)
  const naechsteWocheTag = (zielWochentag: number): { iso: string; deutsch: string } => {
    let offset = 7 - heute.wochentag + zielWochentag;
    if (offset < 7) offset += 7;
    return tagOffset(offset);
  };

  const heuteFmt = tagOffset(0);
  const morgenFmt = tagOffset(1);
  const uebermorgenFmt = tagOffset(2);
  const inEinerWoche = tagOffset(7);
  const inZweiWochen = tagOffset(14);
  const naechsteWocheMo = naechsteWocheTag(1);
  const naechsteWocheDi = naechsteWocheTag(2);
  const naechsteWocheMi = naechsteWocheTag(3);
  const naechsteWocheDo = naechsteWocheTag(4);
  const naechsteWocheFr = naechsteWocheTag(5);

  return `# Aktueller Zeit-Kontext (NUTZE DIESE WERTE fuer ALLE Datumsberechnungen)

Heute ist ${heuteFmt.deutsch}.
Aktuelle Uhrzeit in Berlin: ${String(heute.stunde).padStart(2, '0')}:${String(heute.minute).padStart(2, '0')} Uhr.

Aktuelles Jahr: ${heute.jahr}
Aktueller Monat: ${monate[heute.monat]}
Aktueller Wochentag: ${wochentage[heute.wochentag]}

## Relative Datumsaufloesung (verwende diese Werte 1:1 wenn der Lead solche Begriffe nutzt)

- "heute" = ${heuteFmt.deutsch} (ISO: ${heuteFmt.iso})
- "morgen" = ${morgenFmt.deutsch} (ISO: ${morgenFmt.iso})
- "uebermorgen" = ${uebermorgenFmt.deutsch} (ISO: ${uebermorgenFmt.iso})
- "in einer Woche" = ${inEinerWoche.deutsch} (ISO: ${inEinerWoche.iso})
- "in zwei Wochen" = ${inZweiWochen.deutsch} (ISO: ${inZweiWochen.iso})
- "naechsten Montag" = ${naechsteWocheMo.deutsch} (ISO: ${naechsteWocheMo.iso})
- "naechsten Dienstag" = ${naechsteWocheDi.deutsch} (ISO: ${naechsteWocheDi.iso})
- "naechsten Mittwoch" = ${naechsteWocheMi.deutsch} (ISO: ${naechsteWocheMi.iso})
- "naechsten Donnerstag" = ${naechsteWocheDo.deutsch} (ISO: ${naechsteWocheDo.iso})
- "naechsten Freitag" = ${naechsteWocheFr.deutsch} (ISO: ${naechsteWocheFr.iso})

## ISO-Format fuer Tool-Aufrufe (kalenderPruefen, terminBuchen)

Wenn du die Tools aufrufst, MUSST du das Format YYYY-MM-DDTHH:MM:SS verwenden.
Beispiel fuer morgen um halb drei nachmittags: ${morgenFmt.iso}T14:30:00

WICHTIG: Das aktuelle Jahr ist ${heute.jahr}, NICHT 2024 oder 2025. Alle Termine fallen in ${heute.jahr} (oder spaeter).`;
}
