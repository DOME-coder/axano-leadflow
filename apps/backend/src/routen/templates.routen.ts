import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../datenbank/prisma.client';
import { authentifizierung, nurAdminOderMitarbeiter } from '../middleware/authentifizierung';
import { AppFehler } from '../middleware/fehlerbehandlung';
import { variablenAufloesen } from '../hilfsfunktionen/variablen';

export const templatesRouter = Router();
templatesRouter.use(authentifizierung);
templatesRouter.use(nurAdminOderMitarbeiter);

const templateSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  betreff: z.string().min(1, 'Betreff ist erforderlich'),
  htmlInhalt: z.string().min(1, 'Inhalt ist erforderlich'),
  textInhalt: z.string().optional(),
  variablen: z.array(z.string()).optional(),
});

// GET /api/v1/templates
templatesRouter.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { erstelltAm: 'desc' },
    });
    res.json({ erfolg: true, daten: templates });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/templates
templatesRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = templateSchema.parse(req.body);
    const template = await prisma.emailTemplate.create({
      data: {
        name: daten.name,
        betreff: daten.betreff,
        htmlInhalt: daten.htmlInhalt,
        textInhalt: daten.textInhalt,
        variablen: daten.variablen || [],
        erstelltVon: req.benutzer!.benutzerId,
      },
    });
    res.status(201).json({ erfolg: true, daten: template });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/templates/:id
templatesRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: req.params.id },
    });
    if (!template) {
      throw new AppFehler('Template nicht gefunden', 404, 'NICHT_GEFUNDEN');
    }
    res.json({ erfolg: true, daten: template });
  } catch (fehler) {
    next(fehler);
  }
});

// PATCH /api/v1/templates/:id
templatesRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = templateSchema.partial().parse(req.body);
    const template = await prisma.emailTemplate.update({
      where: { id: req.params.id },
      data: {
        ...daten,
        variablen: daten.variablen || undefined,
        version: { increment: 1 },
      },
    });
    res.json({ erfolg: true, daten: template });
  } catch (fehler) {
    next(fehler);
  }
});

// DELETE /api/v1/templates/:id
templatesRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.emailTemplate.delete({ where: { id: req.params.id } });
    res.json({ erfolg: true, nachricht: 'Template gelöscht' });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/templates/:id/vorschau
templatesRouter.post('/:id/vorschau', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: req.params.id },
    });
    if (!template) {
      throw new AppFehler('Template nicht gefunden', 404, 'NICHT_GEFUNDEN');
    }

    const beispielLead = {
      vorname: 'Max',
      nachname: 'Mustermann',
      email: 'max@beispiel.de',
      telefon: '+491511234567',
      status: 'Neu',
      erstelltAm: new Date(),
      kampagne: { name: 'Beispiel-Kampagne' },
      zugewiesener: { vorname: 'Lisa', nachname: 'Müller' },
      felddaten: [],
    };

    const vorschau = {
      betreff: variablenAufloesen(template.betreff, beispielLead),
      html: variablenAufloesen(template.htmlInhalt, beispielLead),
      text: template.textInhalt ? variablenAufloesen(template.textInhalt, beispielLead) : null,
    };

    res.json({ erfolg: true, daten: vorschau });
  } catch (fehler) {
    next(fehler);
  }
});
