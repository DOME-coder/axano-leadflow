import { Router, Request, Response } from 'express';
import { prisma } from '../datenbank/prisma.client';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      erfolg: true,
      daten: {
        status: 'ok',
        zeitstempel: new Date().toISOString(),
        dienste: {
          datenbank: 'verbunden',
        },
      },
    });
  } catch {
    res.status(503).json({
      erfolg: false,
      fehler: 'Dienst nicht verfügbar',
      daten: {
        status: 'fehler',
        zeitstempel: new Date().toISOString(),
        dienste: {
          datenbank: 'nicht verbunden',
        },
      },
    });
  }
});
