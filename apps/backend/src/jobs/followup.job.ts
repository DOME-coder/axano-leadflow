import { Worker, Job } from 'bullmq';
import { redisVerbindung } from './queue';
import { prisma } from '../datenbank/prisma.client';
import { followUpDirektSenden } from '../dienste/anruf.dienst';
import { logger } from '../hilfsfunktionen/logger';

interface FollowUpJobDaten {
  leadId: string;
  kampagneId: string;
  grund: 'verpasst' | 'voicemail' | 'unerreichbar' | 'nichtInteressiert' | 'terminBestaetigung' | 'rueckruf';
}

/**
 * Startet den Follow-up-Worker für verzögerte E-Mail/WhatsApp-Nachrichten.
 */
export function followUpWorkerStarten() {
  const worker = new Worker('follow-ups', async (job: Job<FollowUpJobDaten>) => {
    const { leadId, kampagneId, grund } = job.data;

    const kampagne = await prisma.kampagne.findUnique({ where: { id: kampagneId } });
    if (!kampagne) {
      logger.warn(`Follow-up: Kampagne ${kampagneId} nicht gefunden`);
      return;
    }

    await followUpDirektSenden(leadId, kampagne, grund);
  }, {
    connection: redisVerbindung,
    concurrency: 5,
  });

  worker.on('failed', (job, fehler) => {
    logger.error(`Follow-up-Job fehlgeschlagen: ${job?.id}`, {
      error: fehler.message,
      daten: job?.data,
    });
  });

  logger.info('Follow-up-Worker gestartet');
  return worker;
}
