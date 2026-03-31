import { Worker, Job } from 'bullmq';
import { redisVerbindung } from './queue';
import { anrufDurchfuehren } from '../dienste/anruf.dienst';
import { logger } from '../hilfsfunktionen/logger';

interface AnrufJobDaten {
  anrufVersuchId: string;
  leadId: string;
  kampagneId: string;
}

/**
 * Startet den Anruf-Worker (eigene Queue mit max 5 gleichzeitigen Anrufen).
 */
export function anrufWorkerStarten() {
  const worker = new Worker('anrufe', async (job: Job<AnrufJobDaten>) => {
    const { anrufVersuchId } = job.data;
    await anrufDurchfuehren(anrufVersuchId);
  }, {
    connection: redisVerbindung,
    concurrency: 5, // Max 5 gleichzeitige Anrufe
  });

  worker.on('failed', (job, fehler) => {
    logger.error(`Anruf-Job fehlgeschlagen: ${job?.id}`, {
      error: fehler.message,
      daten: job?.data,
    });
  });

  logger.info('Anruf-Worker gestartet (max 5 gleichzeitig)');
  return worker;
}
