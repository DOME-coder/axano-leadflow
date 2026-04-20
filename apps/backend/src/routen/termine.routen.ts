import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../datenbank/prisma.client';
import { authentifizierung } from '../middleware/authentifizierung';

export const termineRouter = Router();
termineRouter.use(authentifizierung);

// GET /api/v1/termine
// Query: von, bis (ISO-Date), kundeId (optional), kampagneId (optional), quelle (optional)
// Liefert alle Termine im Zeitraum mit vollstaendigen Lead-, Kampagnen- und Kunden-Daten.
termineRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vonStr = typeof req.query.von === 'string' ? req.query.von : undefined;
    const bisStr = typeof req.query.bis === 'string' ? req.query.bis : undefined;
    const kundeId = typeof req.query.kundeId === 'string' ? req.query.kundeId : undefined;
    const kampagneId = typeof req.query.kampagneId === 'string' ? req.query.kampagneId : undefined;
    const quelle = typeof req.query.quelle === 'string' ? req.query.quelle : undefined;

    const filter: Record<string, unknown> = {};

    if (vonStr || bisStr) {
      const beginnFilter: Record<string, Date> = {};
      if (vonStr) beginnFilter.gte = new Date(vonStr);
      if (bisStr) beginnFilter.lte = new Date(bisStr);
      filter.beginnAm = beginnFilter;
    }

    if (kampagneId) {
      filter.kampagneId = kampagneId;
    } else if (kundeId) {
      // Nur Termine, deren Lead zu einer Kampagne dieses Kunden gehoert
      filter.lead = { is: { kampagne: { kundeId } } };
    }

    if (quelle) {
      filter.quelle = quelle;
    }

    const termine = await prisma.termin.findMany({
      where: filter,
      include: {
        lead: {
          select: {
            id: true,
            vorname: true,
            nachname: true,
            email: true,
            telefon: true,
            status: true,
            quelle: true,
            kampagneId: true,
            kampagne: {
              select: {
                id: true,
                name: true,
                kunde: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { beginnAm: 'asc' },
    });

    res.json({ erfolg: true, daten: { eintraege: termine, gesamt: termine.length } });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/termine/:id – einzelner Termin mit allen Details
termineRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const termin = await prisma.termin.findUnique({
      where: { id: req.params.id },
      include: {
        lead: {
          include: {
            felddaten: { include: { feld: { select: { feldname: true, bezeichnung: true } } } },
            kampagne: {
              select: { id: true, name: true, kunde: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    if (!termin) {
      res.status(404).json({ erfolg: false, fehler: 'Termin nicht gefunden' });
      return;
    }

    res.json({ erfolg: true, daten: termin });
  } catch (fehler) {
    next(fehler);
  }
});
