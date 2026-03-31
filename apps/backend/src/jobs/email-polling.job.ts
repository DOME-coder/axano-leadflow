import { Worker } from 'bullmq';
import { redisVerbindung, emailPollingQueue } from './queue';
import { prisma } from '../datenbank/prisma.client';
import { neueEmailsAbrufen, absenderNameAufteilen } from '../dienste/imap.dienst';
import { leadErstellen } from '../dienste/lead.dienst';
import { entschluesseln } from '../hilfsfunktionen/verschluesselung';
import { logger } from '../hilfsfunktionen/logger';

/**
 * Startet den E-Mail-Polling-Job als BullMQ Repeatable Job (alle 2 Minuten).
 */
export function emailPollingStarten() {
  // Repeatable Job einrichten
  emailPollingQueue.add(
    'email-polling',
    {},
    {
      repeat: { every: 2 * 60 * 1000 }, // Alle 2 Minuten
      jobId: 'email-polling-wiederholt',
      removeOnComplete: true,
      removeOnFail: false,
    }
  ).catch((fehler) => {
    logger.error('E-Mail-Polling-Job konnte nicht erstellt werden:', { error: fehler });
  });

  const worker = new Worker('email-polling', async () => {
    // Alle aktiven Kampagnen mit Trigger-Typ "email" laden
    const kampagnen = await prisma.kampagne.findMany({
      where: {
        triggerTyp: 'email',
        status: 'aktiv',
      },
    });

    if (kampagnen.length === 0) return;

    for (const kampagne of kampagnen) {
      try {
        const triggerKonfig = kampagne.triggerKonfiguration as Record<string, string> | null;
        if (!triggerKonfig?.imap_host || !triggerKonfig?.imap_benutzer) {
          continue;
        }

        // Passwort entschlüsseln
        let passwort = triggerKonfig.imap_passwort || '';
        try {
          passwort = entschluesseln(passwort);
        } catch {
          // Passwort ist möglicherweise nicht verschlüsselt
        }

        const emails = await neueEmailsAbrufen({
          imap_host: triggerKonfig.imap_host,
          imap_port: parseInt(triggerKonfig.imap_port || '993'),
          imap_benutzer: triggerKonfig.imap_benutzer,
          imap_passwort: passwort,
          imap_ordner: triggerKonfig.imap_ordner || 'INBOX',
        });

        for (const email of emails) {
          const { vorname, nachname } = absenderNameAufteilen(email.absenderName);

          await leadErstellen({
            kampagneId: kampagne.id,
            vorname,
            nachname,
            email: email.absenderEmail,
            quelle: 'email',
            rohdaten: {
              betreff: email.betreff,
              nachricht: email.textInhalt,
              datum: email.datum.toISOString(),
            },
          });

          logger.info(`Lead aus E-Mail erstellt: ${email.absenderEmail} → Kampagne ${kampagne.name}`);
        }
      } catch (fehler) {
        logger.error(`E-Mail-Polling fehlgeschlagen für Kampagne ${kampagne.id}:`, {
          error: fehler instanceof Error ? fehler.message : fehler,
        });
      }
    }
  }, {
    connection: redisVerbindung,
    concurrency: 1,
  });

  worker.on('failed', (job, fehler) => {
    logger.error('E-Mail-Polling-Job fehlgeschlagen:', { jobId: job?.id, error: fehler.message });
  });

  logger.info('E-Mail-Polling-Worker gestartet (alle 2 Minuten)');
  return worker;
}
