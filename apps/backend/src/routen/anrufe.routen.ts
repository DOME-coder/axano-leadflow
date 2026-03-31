import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../datenbank/prisma.client';
import { authentifizierung } from '../middleware/authentifizierung';
import { anrufSequenzStarten } from '../dienste/anruf.dienst';

export const anrufeRouter = Router();
anrufeRouter.use(authentifizierung);

// Kampagnen-spezifische Anruf-Routen
export const kampagneAnrufeRouter = Router({ mergeParams: true });
kampagneAnrufeRouter.use(authentifizierung);

// GET /api/v1/kampagnen/:kampagneId/anrufe
kampagneAnrufeRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneId } = req.params;
    const seite = typeof req.query.seite === 'string' ? parseInt(req.query.seite) : 1;
    const proSeite = 50;
    const skip = (seite - 1) * proSeite;

    const [anrufe, gesamt] = await Promise.all([
      prisma.anrufVersuch.findMany({
        where: { kampagneId },
        include: {
          lead: { select: { id: true, vorname: true, nachname: true, email: true, telefon: true, status: true } },
        },
        orderBy: { erstelltAm: 'desc' },
        skip,
        take: proSeite,
      }),
      prisma.anrufVersuch.count({ where: { kampagneId } }),
    ]);

    res.json({ erfolg: true, daten: { eintraege: anrufe, gesamt, seite, proSeite } });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/kampagnen/:kampagneId/anrufe/starten – Manuell Sequenz für alle neuen Leads starten
kampagneAnrufeRouter.post('/starten', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kampagneId } = req.params;

    const neueLeads = await prisma.lead.findMany({
      where: {
        kampagneId,
        status: 'Neu',
        geloescht: false,
        telefon: { not: null },
      },
    });

    let gestartet = 0;
    for (const lead of neueLeads) {
      // Prüfe ob bereits Anrufversuche existieren
      const bestehend = await prisma.anrufVersuch.findFirst({
        where: { leadId: lead.id },
      });

      if (!bestehend) {
        await anrufSequenzStarten(lead.id, kampagneId);
        gestartet++;
      }
    }

    res.json({
      erfolg: true,
      daten: { gestartet, gesamt: neueLeads.length },
      nachricht: `${gestartet} Anruf-Sequenzen gestartet`,
    });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/anrufe/:id – Einzelner Anrufversuch mit Transkript
anrufeRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const anruf = await prisma.anrufVersuch.findUnique({
      where: { id: req.params.id },
      include: {
        lead: { select: { id: true, vorname: true, nachname: true, email: true, telefon: true } },
      },
    });

    if (!anruf) {
      res.status(404).json({ erfolg: false, fehler: 'Anruf nicht gefunden' });
      return;
    }

    res.json({ erfolg: true, daten: anruf });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/anrufe/:id/wiederholen – Manuell erneut anrufen
anrufeRouter.post('/:id/wiederholen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const anruf = await prisma.anrufVersuch.findUnique({
      where: { id: req.params.id },
    });

    if (!anruf) {
      res.status(404).json({ erfolg: false, fehler: 'Anruf nicht gefunden' });
      return;
    }

    await anrufSequenzStarten(anruf.leadId, anruf.kampagneId);
    res.json({ erfolg: true, nachricht: 'Neue Anruf-Sequenz gestartet' });
  } catch (fehler) {
    next(fehler);
  }
});
