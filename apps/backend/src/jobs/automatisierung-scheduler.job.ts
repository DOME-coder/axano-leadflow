import { Worker } from 'bullmq';
import { redisVerbindung, schedulerQueue } from './queue';
import { prisma } from '../datenbank/prisma.client';
import { automatisierungAusfuehren } from '../dienste/automatisierung.dienst';
import { logger } from '../hilfsfunktionen/logger';

/**
 * Scheduler-Job für Automatisierungen mit Trigger-Typ "inaktivitaet" und "zeitplan".
 * Läuft alle 5 Minuten als wiederholender BullMQ-Job.
 */
export function automatisierungSchedulerStarten() {
  // Wiederholenden Job einrichten (alle 5 Minuten)
  schedulerQueue.add(
    'automatisierung-scheduler',
    {},
    {
      repeat: { every: 5 * 60 * 1000 },
      jobId: 'automatisierung-scheduler-wiederholt',
      removeOnComplete: true,
      removeOnFail: false,
    }
  ).catch((fehler) => {
    logger.error('Automatisierung-Scheduler-Job konnte nicht erstellt werden:', { error: fehler });
  });

  const worker = new Worker('automatisierung-scheduler', async () => {
    await inaktivitaetPruefen();
    await zeitplanPruefen();
  }, {
    connection: redisVerbindung,
    concurrency: 1,
  });

  worker.on('failed', (job, fehler) => {
    logger.error('Automatisierung-Scheduler fehlgeschlagen:', { jobId: job?.id, error: fehler.message });
  });

  logger.info('Automatisierung-Scheduler gestartet (alle 5 Minuten)');
  return worker;
}

/**
 * Prüft Automatisierungen mit Trigger "inaktivitaet":
 * Findet Leads ohne Aktivität seit X Tagen und startet die Automatisierung.
 */
async function inaktivitaetPruefen() {
  const automatisierungen = await prisma.automatisierung.findMany({
    where: {
      triggerTyp: 'inaktivitaet',
      aktiv: true,
    },
    include: {
      kampagne: { select: { id: true, status: true } },
    },
  });

  for (const auto of automatisierungen) {
    if (auto.kampagne.status !== 'aktiv') continue;

    const konfig = auto.triggerKonfiguration as Record<string, unknown> | null;
    const inaktivTage = (konfig?.tage as number) || 3;
    const schwellenwert = new Date(Date.now() - inaktivTage * 24 * 60 * 60 * 1000);

    try {
      // Bereits verarbeitete Lead-IDs für diese Automatisierung ermitteln
      const bereitsVerarbeitet = await prisma.automatisierungsAusfuehrung.findMany({
        where: {
          automatisierungId: auto.id,
          status: { in: ['laeuft', 'abgeschlossen'] },
        },
        select: { leadId: true },
      });
      const verarbeiteteLeadIds = new Set(bereitsVerarbeitet.map((a) => a.leadId));

      // Leads finden, die vor dem Schwellenwert erstellt wurden
      const kandidaten = await prisma.lead.findMany({
        where: {
          kampagneId: auto.kampagne.id,
          geloescht: false,
          erstelltAm: { lte: schwellenwert },
        },
        select: { id: true },
      });

      // Bereits verarbeitete Leads herausfiltern
      const nochNichtVerarbeitet = kandidaten.filter((l) => !verarbeiteteLeadIds.has(l.id));

      // Für jeden Lead prüfen, ob die letzte Aktivität zu lange her ist
      for (const lead of nochNichtVerarbeitet) {
        const letzteAktivitaet = await prisma.leadAktivitaet.findFirst({
          where: { leadId: lead.id },
          orderBy: { erstelltAm: 'desc' },
          select: { erstelltAm: true },
        });

        const letzteZeit = letzteAktivitaet?.erstelltAm || new Date(0);

        if (letzteZeit < schwellenwert) {
          try {
            await automatisierungAusfuehren(auto.id, lead.id);
            logger.info(`Inaktivitäts-Automatisierung gestartet: ${auto.name} für Lead ${lead.id}`);
          } catch (fehler) {
            logger.error(`Fehler bei Inaktivitäts-Automatisierung ${auto.id} für Lead ${lead.id}:`, { error: fehler });
          }
        }
      }
    } catch (fehler) {
      logger.error(`Fehler beim Prüfen der Inaktivitäts-Automatisierung ${auto.id}:`, { error: fehler });
    }
  }
}

/**
 * Prüft Automatisierungen mit Trigger "zeitplan":
 * Findet Automatisierungen, die jetzt ausgeführt werden sollen.
 * Erwartet triggerKonfiguration mit { wochentage?: number[], uhrzeit?: string }
 */
async function zeitplanPruefen() {
  const automatisierungen = await prisma.automatisierung.findMany({
    where: {
      triggerTyp: 'zeitplan',
      aktiv: true,
    },
    include: {
      kampagne: { select: { id: true, status: true } },
    },
  });

  const jetzt = new Date();
  const aktuellerWochentag = jetzt.getDay(); // 0 = Sonntag
  const aktuelleUhrzeit = `${String(jetzt.getHours()).padStart(2, '0')}:${String(jetzt.getMinutes()).padStart(2, '0')}`;

  for (const auto of automatisierungen) {
    if (auto.kampagne.status !== 'aktiv') continue;

    const konfig = auto.triggerKonfiguration as Record<string, unknown> | null;
    const wochentage = konfig?.wochentage as number[] | undefined;
    const uhrzeit = konfig?.uhrzeit as string | undefined;

    // Wochentag prüfen (falls konfiguriert)
    if (wochentage && wochentage.length > 0 && !wochentage.includes(aktuellerWochentag)) {
      continue;
    }

    // Uhrzeit prüfen (±5 Minuten Toleranz wegen Scheduler-Intervall)
    if (uhrzeit) {
      const [zielStunde, zielMinute] = uhrzeit.split(':').map(Number);
      const zielMinutenGesamt = zielStunde * 60 + zielMinute;
      const aktuelleMinutenGesamt = jetzt.getHours() * 60 + jetzt.getMinutes();
      const differenz = Math.abs(aktuelleMinutenGesamt - zielMinutenGesamt);

      // Nur auslösen wenn innerhalb von 5 Minuten (Scheduler-Intervall)
      if (differenz > 5) continue;
    }

    try {
      // Alle aktiven Leads der Kampagne finden, die heute noch nicht verarbeitet wurden
      const heuteStart = new Date(jetzt);
      heuteStart.setHours(0, 0, 0, 0);

      // Heute bereits verarbeitete Lead-IDs ermitteln
      const heuteVerarbeitet = await prisma.automatisierungsAusfuehrung.findMany({
        where: {
          automatisierungId: auto.id,
          erstelltAm: { gte: heuteStart },
        },
        select: { leadId: true },
      });
      const heuteVerarbeiteteIds = new Set(heuteVerarbeitet.map((a) => a.leadId));

      const alleLeads = await prisma.lead.findMany({
        where: {
          kampagneId: auto.kampagne.id,
          geloescht: false,
        },
        select: { id: true },
      });

      const leads = alleLeads.filter((l) => !heuteVerarbeiteteIds.has(l.id));

      for (const lead of leads) {
        try {
          await automatisierungAusfuehren(auto.id, lead.id);
          logger.info(`Zeitplan-Automatisierung gestartet: ${auto.name} für Lead ${lead.id}`);
        } catch (fehler) {
          logger.error(`Fehler bei Zeitplan-Automatisierung ${auto.id} für Lead ${lead.id}:`, { error: fehler });
        }
      }

      logger.info(`Zeitplan-Automatisierung "${auto.name}" geprüft: ${leads.length} Leads, Uhrzeit: ${aktuelleUhrzeit}`);
    } catch (fehler) {
      logger.error(`Fehler beim Prüfen der Zeitplan-Automatisierung ${auto.id}:`, { error: fehler });
    }
  }
}
