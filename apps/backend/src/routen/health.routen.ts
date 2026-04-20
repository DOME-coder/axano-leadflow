import { Router, Request, Response } from 'express';
import { prisma } from '../datenbank/prisma.client';
import { redisVerbindung } from '../jobs/queue';

export const healthRouter = Router();

async function datenbankPruefen(): Promise<{ status: 'ok' | 'fehler'; latenzMs?: number; fehler?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', latenzMs: Date.now() - start };
  } catch (fehler) {
    return { status: 'fehler', fehler: fehler instanceof Error ? fehler.message : 'Unbekannter Fehler' };
  }
}

async function redisPruefen(): Promise<{ status: 'ok' | 'fehler'; latenzMs?: number; fehler?: string }> {
  const start = Date.now();
  try {
    const antwort = await redisVerbindung.ping();
    if (antwort !== 'PONG') {
      return { status: 'fehler', fehler: `Unerwartete Antwort: ${antwort}` };
    }
    return { status: 'ok', latenzMs: Date.now() - start };
  } catch (fehler) {
    return { status: 'fehler', fehler: fehler instanceof Error ? fehler.message : 'Unbekannter Fehler' };
  }
}

// GET /api/v1/health – Liveness: nur "läuft die App überhaupt?"
healthRouter.get('/', async (_req: Request, res: Response) => {
  res.json({
    erfolg: true,
    daten: {
      status: 'ok',
      zeitstempel: new Date().toISOString(),
    },
  });
});

// GET /api/v1/health/readiness – Readiness: laufen alle Abhängigkeiten?
healthRouter.get('/readiness', async (_req: Request, res: Response) => {
  const [datenbank, redis] = await Promise.all([datenbankPruefen(), redisPruefen()]);

  const alleOk = datenbank.status === 'ok' && redis.status === 'ok';

  res.status(alleOk ? 200 : 503).json({
    erfolg: alleOk,
    daten: {
      status: alleOk ? 'ok' : 'fehler',
      zeitstempel: new Date().toISOString(),
      dienste: {
        datenbank,
        redis,
      },
    },
  });
});
