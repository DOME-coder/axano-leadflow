import { Worker, Job } from 'bullmq';
import { redisVerbindung, anrufPollingQueue } from './queue';
import { vapiAnrufAbrufen } from '../dienste/vapi.dienst';
import { anrufErgebnisVerarbeiten } from '../dienste/anruf.dienst';
import { prisma } from '../datenbank/prisma.client';
import { logger } from '../hilfsfunktionen/logger';

interface PollingJobDaten {
  vapiCallId: string;
  anrufVersuchId: string;
  kundeId?: string;
  pollAnzahl: number;
}

const MAX_POLLS = 60; // Max 60 Polls × 10 Sek = 10 Minuten
const POLL_INTERVALL = 10000; // 10 Sekunden

/**
 * Startet den Anruf-Polling-Worker.
 * Pollt VAPI alle 10 Sekunden bis der Anruf beendet ist,
 * dann verarbeitet er das Ergebnis (Transkript, GPT-Analyse, Status-Update).
 */
export function anrufPollingWorkerStarten() {
  const worker = new Worker('anruf-polling', async (job: Job<PollingJobDaten>) => {
    const { vapiCallId, anrufVersuchId, kundeId, pollAnzahl } = job.data;

    try {
      const callDaten = await vapiAnrufAbrufen(vapiCallId, kundeId || null);

      if (callDaten.status === 'ended') {
        // Anruf beendet → Ergebnis verarbeiten
        logger.info(`VAPI-Polling: Anruf ${vapiCallId} beendet (${callDaten.endedReason})`);

        await anrufErgebnisVerarbeiten(
          vapiCallId,
          callDaten.transcript || '',
          callDaten.endedReason || 'unknown',
          callDaten.duration
        );

        logger.info(`VAPI-Polling: Ergebnis verarbeitet für ${vapiCallId}`);
        return;
      }

      // Anruf läuft noch → nächsten Poll planen
      if (pollAnzahl >= MAX_POLLS) {
        logger.warn(`VAPI-Polling: Max Polls erreicht für ${vapiCallId} (Status: ${callDaten.status})`);

        // Versuch als Fehler markieren
        await prisma.anrufVersuch.update({
          where: { id: anrufVersuchId },
          data: {
            status: 'fehler',
            fehlerNachricht: `Polling-Timeout: Anruf nach ${MAX_POLLS * POLL_INTERVALL / 1000}s noch nicht beendet`,
          },
        });
        return;
      }

      // Nächsten Poll einplanen
      await anrufPollingQueue.add('anruf-poll', {
        vapiCallId,
        anrufVersuchId,
        kundeId,
        pollAnzahl: pollAnzahl + 1,
      }, {
        delay: POLL_INTERVALL,
        jobId: `poll-${vapiCallId}-${pollAnzahl + 1}`,
      });

    } catch (fehler) {
      logger.error(`VAPI-Polling fehlgeschlagen für ${vapiCallId}:`, { error: fehler });

      // Bei API-Fehlern trotzdem weiter pollen (könnte temporär sein)
      if (pollAnzahl < MAX_POLLS) {
        await anrufPollingQueue.add('anruf-poll', {
          vapiCallId,
          anrufVersuchId,
          kundeId,
          pollAnzahl: pollAnzahl + 1,
        }, {
          delay: POLL_INTERVALL * 2, // Doppeltes Intervall bei Fehler
          jobId: `poll-${vapiCallId}-${pollAnzahl + 1}`,
        });
      }
    }
  }, {
    connection: redisVerbindung,
    concurrency: 10,
  });

  worker.on('failed', (job, fehler) => {
    logger.error(`Polling-Job fehlgeschlagen: ${job?.id}`, { error: fehler.message });
  });

  logger.info('Anruf-Polling-Worker gestartet');
  return worker;
}

/**
 * Startet das Polling für einen laufenden VAPI-Anruf.
 */
export async function anrufPollingStarten(vapiCallId: string, anrufVersuchId: string, kundeId?: string) {
  await anrufPollingQueue.add('anruf-poll', {
    vapiCallId,
    anrufVersuchId,
    kundeId,
    pollAnzahl: 1,
  }, {
    delay: POLL_INTERVALL,
    jobId: `poll-${vapiCallId}-1`,
  });

  logger.info(`VAPI-Polling gestartet für Call ${vapiCallId}`);
}
