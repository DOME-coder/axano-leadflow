import { prisma } from '../datenbank/prisma.client';
import { vapiAnrufStarten } from './vapi.dienst';
import { transkriptAnalysieren, voicemailBackupCheck } from './gpt.dienst';
import { emailMitTemplateSenden } from './email.dienst';
import { superchatKontaktSuchen, superchatKontaktErstellen, superchatTemplateNachrichtSenden, hatLeadPerWhatsAppGeantwortet } from './whatsapp.dienst';
import { integrationKonfigurationLesen } from './integrationen.dienst';
import { socketServer } from '../websocket/socket.handler';
import { logger } from '../hilfsfunktionen/logger';
import { anrufQueue, followUpQueue } from '../jobs/queue';
import { zeitfensterAktiv, naechsterZeitfensterbeginn } from '../hilfsfunktionen/zeitfenster';
import { istHandynummer } from '../hilfsfunktionen/telefon.formatierung';

interface AnrufZeitslot {
  stunde: number;
  minute: number;
}

type FollowUpGrund = 'verpasst' | 'voicemail' | 'unerreichbar';

/**
 * Startet die Anruf-Sequenz für einen Lead.
 */
export async function anrufSequenzStarten(leadId: string, kampagneId: string) {
  const kampagne = await prisma.kampagne.findUnique({ where: { id: kampagneId } });
  if (!kampagne) return;

  if (!kampagne.vapiAktiviert || !kampagne.vapiAssistantId) return;

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
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'Nicht erreichbar' },
    });
    await aktivitaetLoggen(leadId, 'anruf_fehlgeschlagen',
      `Alle ${kampagne.maxAnrufVersuche} Anrufversuche erschöpft – Lead nicht erreichbar`);

    // Follow-up "Nicht erreichbar" senden
    await followUpSenden(leadId, kampagneId, kampagne, 'unerreichbar');
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
 * Plant einen sofortigen Rückruf (5 Sek Delay) — für fehlerhaftes Auflegen.
 */
async function sofortigenAnrufPlanen(leadId: string, kampagneId: string, versuchNummer: number) {
  const versuch = await prisma.anrufVersuch.create({
    data: { leadId, kampagneId, versuchNummer, status: 'geplant', geplantFuer: new Date() },
  });

  await anrufQueue.add('anruf-durchfuehren', {
    anrufVersuchId: versuch.id, leadId, kampagneId,
  }, { delay: 5000, jobId: `anruf-sofort-${versuch.id}` });

  logger.info(`Sofortiger Rückruf geplant (5s) für Lead ${leadId} – Versuch #${versuchNummer}`);
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

  // Ab Versuch #2: Prüfe ob Lead zwischenzeitlich per WhatsApp geantwortet hat
  if (lead.telefon && versuch.versuchNummer > 1) {
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

    // Bestehende Messages (Gesprächshistorie) + Lead-Daten zusammenführen
    const bisherMessages = (assistantOverrides?.model as Record<string, unknown> | undefined)?.messages as Array<Record<string, string>> | undefined;
    const alleMessages = [...(bisherMessages || []), leadInfoMessage];

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
            properties: { gewuenschteZeit: { type: 'string', description: 'Gewünschte Zeit im Format 2025-06-16T11:30:00' } },
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
              gewuenschteZeit: { type: 'string', description: 'Bestätigte Zeit im Format 2025-06-16T11:30:00' },
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

    assistantOverrides = {
      ...assistantOverrides,
      server: { url: `${apiBaseUrl}/api/v1/webhooks/vapi/tools`, timeoutSeconds: 20 },
      model: {
        ...(assistantOverrides?.model as Record<string, unknown> | undefined),
        tools: vapiTools,
      },
    };

    // VAPI-Anruf starten
    const kundeName = [lead.vorname, lead.nachname].filter(Boolean).join(' ');
    const callId = await vapiAnrufStarten(
      lead.telefon!,
      kampagne.vapiAssistantId!,
      kampagne.vapiPhoneNumberId!,
      kundeName,
      {
        leadId: lead.id,
        kampagneId: versuch.kampagneId,
        versuchNr: String(versuch.versuchNummer),
      },
      assistantOverrides
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

      if (versuch.versuchNummer === 1) {
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, 'voicemail');
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
  const statusMap: Record<string, string> = {
    interessiert: 'Termin gebucht',
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

    // Bei Endstatus: Sequenz beenden
    if (['interessiert', 'nicht_interessiert', 'falsche_nummer'].includes(analyse.ergebnis)) {
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

  // Bei voicemail/nicht_abgenommen/aufgelegt/hung_up/disconnected: nächsten Versuch planen
  const retryErgebnisse = ['voicemail', 'nicht_abgenommen', 'aufgelegt', 'hung_up', 'disconnected'];
  if (retryErgebnisse.includes(analyse.ergebnis)) {
    await aktivitaetLoggen(versuch.leadId, 'anruf_abgeschlossen',
      `Anruf #${versuch.versuchNummer}: ${analyse.verdict} – nächster Versuch wird geplant`);

    // Follow-up E-Mail + WhatsApp nach erstem gescheiterten Versuch
    if (versuch.versuchNummer === 1) {
      const followUpGrund: FollowUpGrund = analyse.ergebnis === 'voicemail' ? 'voicemail' : 'verpasst';
      await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, followUpGrund);
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
  kampagne: { emailAktiviert: boolean; whatsappAktiviert: boolean; emailTemplateVerpasst: string | null; emailTemplateVoicemail: string | null; emailTemplateUnerreichbar: string | null; whatsappTemplateVerpasst: string | null; whatsappTemplateUnerreichbar: string | null; whatsappKanalId: string | null },
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
 * Sendet Follow-up direkt (ohne Zeitfenster-Prüfung). Wird vom Worker aufgerufen.
 */
export async function followUpDirektSenden(
  leadId: string,
  kampagne: { emailAktiviert: boolean; whatsappAktiviert: boolean; emailTemplateVerpasst: string | null; emailTemplateVoicemail: string | null; emailTemplateUnerreichbar: string | null; whatsappTemplateVerpasst: string | null; whatsappTemplateUnerreichbar: string | null; whatsappKanalId: string | null },
  grund: FollowUpGrund
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      kampagne: { select: { name: true } },
      zugewiesener: { select: { vorname: true, nachname: true } },
      felddaten: { include: { feld: { select: { feldname: true } } } },
    },
  });

  if (!lead) return;

  // Template-IDs nach Grund auswählen
  const emailTemplateId: string | null = {
    verpasst: kampagne.emailTemplateVerpasst,
    voicemail: kampagne.emailTemplateVoicemail,
    unerreichbar: kampagne.emailTemplateUnerreichbar,
  }[grund];

  const whatsappTemplateId: string | null = {
    verpasst: kampagne.whatsappTemplateVerpasst,
    voicemail: null,
    unerreichbar: kampagne.whatsappTemplateUnerreichbar,
  }[grund];

  const grundBezeichnung: Record<FollowUpGrund, string> = {
    verpasst: 'Verpasster Anruf',
    voicemail: 'Voicemail',
    unerreichbar: 'Nicht erreichbar',
  };

  // E-Mail senden (wenn aktiviert + Template vorhanden)
  if (kampagne.emailAktiviert && emailTemplateId && lead.email) {
    try {
      await emailMitTemplateSenden(emailTemplateId, lead);
      await aktivitaetLoggen(leadId, 'email_gesendet',
        `Follow-up E-Mail gesendet: ${grundBezeichnung[grund]}`);
    } catch (fehler) {
      logger.error('Follow-up E-Mail fehlgeschlagen:', { leadId, grund, error: fehler });
    }
  }

  // WhatsApp senden (wenn aktiviert + Template + Kanal + Handynummer)
  if (kampagne.whatsappAktiviert && whatsappTemplateId && kampagne.whatsappKanalId && lead.telefon && istHandynummer(lead.telefon)) {
    try {
      const superchatKonfig = await integrationKonfigurationLesen('superchat');
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
 * Berechnet die nächste Anrufzeit basierend auf Zeitslots.
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

  // Aktuelle Stunde/Minute in Berlin
  const berlinZeit = new Date(jetzt.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  const aktuelleMinuten = berlinZeit.getHours() * 60 + berlinZeit.getMinutes();
  const tag = berlinZeit.getDay(); // 0=So, 6=Sa

  // Wochenende → Montag erste Zeit
  if (tag === 0 || tag === 6) {
    const tageAbstand = tag === 0 ? 1 : 2;
    const montag = new Date(jetzt);
    montag.setDate(montag.getDate() + tageAbstand);
    montag.setHours(slots[0].stunde, slots[0].minute, 0, 0);
    return zufallsVerzoegerungAnwenden(montag, verzoegerung);
  }

  // Nach 21:00 → morgen erste Zeit
  if (aktuelleMinuten >= 21 * 60) {
    const morgen = new Date(jetzt);
    morgen.setDate(morgen.getDate() + 1);
    morgen.setHours(slots[0].stunde, slots[0].minute, 0, 0);
    return zufallsVerzoegerungAnwenden(morgen, verzoegerung);
  }

  // Vor 09:00 → heute erste Zeit
  if (aktuelleMinuten < 9 * 60) {
    const heute = new Date(jetzt);
    heute.setHours(slots[0].stunde, slots[0].minute, 0, 0);
    return zufallsVerzoegerungAnwenden(heute, verzoegerung);
  }

  // Nächste verfügbare Anrufzeit finden
  for (const slot of slots) {
    const slotMinuten = slot.stunde * 60 + slot.minute;
    if (slotMinuten > aktuelleMinuten) {
      const ziel = new Date(jetzt);
      ziel.setHours(slot.stunde, slot.minute, 0, 0);
      return zufallsVerzoegerungAnwenden(ziel, verzoegerung);
    }
  }

  // Alle Zeiten heute vorbei → morgen erste Zeit
  const morgen = new Date(jetzt);
  morgen.setDate(morgen.getDate() + 1);
  morgen.setHours(slots[0].stunde, slots[0].minute, 0, 0);
  return zufallsVerzoegerungAnwenden(morgen, verzoegerung);
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
