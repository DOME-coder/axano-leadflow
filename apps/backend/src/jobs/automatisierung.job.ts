import { Worker, Job } from 'bullmq';
import { redisVerbindung } from './queue';
import { automatisierungsQueue } from './queue';
import { prisma } from '../datenbank/prisma.client';
import { bedingungenErfuellt } from '../hilfsfunktionen/bedingungen';
import { zeitfensterAktiv, naechsterZeitfensterbeginn } from '../hilfsfunktionen/zeitfenster';
import { emailMitTemplateSenden } from '../dienste/email.dienst';
import { socketServer } from '../websocket/socket.handler';
import { logger } from '../hilfsfunktionen/logger';

interface JobDaten {
  ausfuehrungId: string;
  automatisierungId: string;
  leadId: string;
  aktuellerSchritt: number;
}

export function workerStarten() {
  const worker = new Worker('automatisierungen', async (job: Job<JobDaten>) => {
    const { ausfuehrungId, automatisierungId, leadId, aktuellerSchritt } = job.data;

    // 1. Automatisierung und Lead laden
    const automatisierung = await prisma.automatisierung.findUnique({
      where: { id: automatisierungId },
      include: { schritte: { orderBy: { reihenfolge: 'asc' } } },
    });

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        kampagne: { select: { name: true, kundeId: true } },
        zugewiesener: { select: { vorname: true, nachname: true } },
        felddaten: { include: { feld: { select: { feldname: true } } } },
      },
    });

    // 2. Abbruchbedingungen prüfen
    if (!automatisierung?.aktiv) {
      logger.info(`Automatisierung ${automatisierungId} ist deaktiviert – übersprungen`);
      return;
    }
    if (!lead || lead.geloescht) {
      logger.info(`Lead ${leadId} nicht gefunden oder gelöscht – übersprungen`);
      return;
    }

    // 3. Bedingungen prüfen
    const bedingungen = automatisierung.bedingungen as Array<{ feld: string; operator: string; wert?: string }>;
    const felddaten = Object.fromEntries(
      lead.felddaten.map((fd) => [fd.feld.feldname, fd.wert])
    );

    if (Array.isArray(bedingungen) && bedingungen.length > 0) {
      if (!bedingungenErfuellt(lead, bedingungen, felddaten)) {
        logger.info(`Bedingungen nicht erfüllt für Automatisierung ${automatisierungId}`);
        await prisma.automatisierungsAusfuehrung.update({
          where: { id: ausfuehrungId },
          data: { status: 'abgeschlossen', abgeschlossenAm: new Date() },
        });
        return;
      }
    }

    // 4. Aktuellen Schritt ermitteln
    const schritt = automatisierung.schritte[aktuellerSchritt];
    if (!schritt) {
      // Alle Schritte abgeschlossen
      await prisma.automatisierungsAusfuehrung.update({
        where: { id: ausfuehrungId },
        data: { status: 'abgeschlossen', abgeschlossenAm: new Date() },
      });
      logger.info(`Automatisierung ${automatisierungId} abgeschlossen für Lead ${leadId}`);
      return;
    }

    // 5. Ausführungsstatus aktualisieren
    await prisma.automatisierungsAusfuehrung.update({
      where: { id: ausfuehrungId },
      data: { aktuellerSchritt, status: 'laeuft' },
    });

    // 6. Schritt ausführen
    const konfig = schritt.konfiguration as Record<string, unknown>;
    let verschieben: Date | null = null;

    switch (schritt.aktionTyp) {
      case 'email_senden': {
        const zeitfenster = konfig.zeitfenster as { von?: string; bis?: string; wochentage?: number[] } | undefined;
        if (zeitfenster && !zeitfensterAktiv(zeitfenster)) {
          verschieben = naechsterZeitfensterbeginn(zeitfenster);
          break;
        }
        const templateId = konfig.templateId as string | undefined;
        if (templateId) {
          await emailMitTemplateSenden(
            templateId,
            lead,
            konfig.anEmail as string | undefined,
            lead.kampagne?.kundeId || null,
          );
          await aktivitaetProtokollieren(leadId, 'email_gesendet', 'E-Mail gesendet via Automatisierung');
        }
        break;
      }

      case 'whatsapp_senden': {
        const zeitfenster = konfig.zeitfenster as { von?: string; bis?: string; wochentage?: number[] } | undefined;
        if (zeitfenster && !zeitfensterAktiv(zeitfenster)) {
          verschieben = naechsterZeitfensterbeginn(zeitfenster);
          break;
        }
        // Platzhalter – Superchat-Integration kommt in Phase 4
        logger.info(`WhatsApp-Nachricht würde gesendet an ${lead.telefon} (Platzhalter)`);
        await aktivitaetProtokollieren(leadId, 'whatsapp_gesendet', 'WhatsApp-Nachricht gesendet (Platzhalter)');
        break;
      }

      case 'status_setzen': {
        const neuerStatus = konfig.neuerStatus as string;
        if (neuerStatus && neuerStatus !== lead.status) {
          await prisma.lead.update({
            where: { id: leadId },
            data: { status: neuerStatus },
          });
          await prisma.leadStatusHistorie.create({
            data: {
              leadId,
              alterStatus: lead.status,
              neuerStatus,
              grund: `Automatisierung: ${automatisierung.name}`,
            },
          });
          await aktivitaetProtokollieren(leadId, 'status_geaendert',
            `Status geändert: ${lead.status} → ${neuerStatus} (Automatisierung)`);

          // Echtzeit-Event
          const io = socketServer();
          if (io) {
            io.to(`kampagne:${lead.kampagneId}`).emit('lead:aktualisiert', {
              lead: { ...lead, status: neuerStatus },
              alterStatus: lead.status,
              neuerStatus,
            });
          }
        }
        break;
      }

      case 'benachrichtigung': {
        const io = socketServer();
        if (io) {
          io.emit('benachrichtigung', {
            typ: 'automatisierung',
            nachricht: konfig.nachricht || `Automatisierung "${automatisierung.name}" ausgeführt`,
            leadId,
          });
        }
        break;
      }

      case 'warten': {
        const minuten = (konfig.minuten as number) || 30;
        verschieben = new Date(Date.now() + minuten * 60 * 1000);
        break;
      }

      case 'warten_bis_uhrzeit': {
        verschieben = naechsterZeitfensterbeginn({
          von: konfig.uhrzeit as string,
          wochentage: konfig.wochentage as number[],
        });
        break;
      }
    }

    // 7. Automatisierungs-Aktivität loggen
    await aktivitaetProtokollieren(leadId, 'automatisierung_ausgefuehrt',
      `Automatisierung "${automatisierung.name}" – Schritt ${aktuellerSchritt + 1}: ${schritt.aktionTyp}`);

    // 8. Nächsten Schritt planen
    const naechsterSchritt = verschieben ? aktuellerSchritt : aktuellerSchritt + 1;
    const verzoegerung = verschieben ? Math.max(verschieben.getTime() - Date.now(), 1000) : 500;

    if (naechsterSchritt < automatisierung.schritte.length || verschieben) {
      await automatisierungsQueue.add(
        'schritt-ausfuehren',
        {
          ausfuehrungId,
          automatisierungId,
          leadId,
          aktuellerSchritt: naechsterSchritt,
        },
        {
          delay: verzoegerung,
          jobId: `auto-${ausfuehrungId}-${naechsterSchritt}-${Date.now()}`,
        }
      );
    } else {
      // Letzter Schritt abgeschlossen
      await prisma.automatisierungsAusfuehrung.update({
        where: { id: ausfuehrungId },
        data: { status: 'abgeschlossen', abgeschlossenAm: new Date() },
      });
    }
  }, {
    connection: redisVerbindung,
    concurrency: 10,
  });

  worker.on('failed', async (job, fehler) => {
    logger.error(`Automatisierungs-Job fehlgeschlagen: ${job?.id}`, {
      error: fehler.message,
      daten: job?.data,
    });

    if (job?.data.ausfuehrungId) {
      await prisma.automatisierungsAusfuehrung.update({
        where: { id: job.data.ausfuehrungId },
        data: {
          status: 'fehler',
          fehlerNachricht: fehler.message,
        },
      }).catch(() => {});
    }
  });

  logger.info('Automatisierungs-Worker gestartet');
  return worker;
}

async function aktivitaetProtokollieren(
  leadId: string,
  typ: 'email_gesendet' | 'whatsapp_gesendet' | 'status_geaendert' | 'automatisierung_ausgefuehrt',
  beschreibung: string
) {
  await prisma.leadAktivitaet.create({
    data: { leadId, typ, beschreibung },
  });
}
