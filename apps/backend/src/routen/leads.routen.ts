import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authentifizierung } from '../middleware/authentifizierung';
import {
  leadsAuflisten,
  leadAbrufen,
  leadAktualisieren,
  leadNotizHinzufuegen,
  leadsNachStatus,
} from '../dienste/lead.dienst';

export const leadsRouter = Router();
leadsRouter.use(authentifizierung);

// GET /api/v1/kampagnen/:kampagneId/leads
export const kampagneLeadsRouter = Router({ mergeParams: true });
kampagneLeadsRouter.use(authentifizierung);

kampagneLeadsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ergebnis = await leadsAuflisten({
      kampagneId: req.params.kampagneId,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      zugewiesenAn: typeof req.query.zugewiesen_an === 'string' ? req.query.zugewiesen_an : undefined,
      suche: typeof req.query.suche === 'string' ? req.query.suche : undefined,
      von: typeof req.query.von === 'string' ? req.query.von : undefined,
      bis: typeof req.query.bis === 'string' ? req.query.bis : undefined,
      seite: typeof req.query.seite === 'string' ? parseInt(req.query.seite) : undefined,
      proSeite: typeof req.query.pro_seite === 'string' ? parseInt(req.query.pro_seite) : undefined,
    });

    res.json({ erfolg: true, daten: ergebnis });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/kampagnen/:kampagneId/leads/pipeline
kampagneLeadsRouter.get('/pipeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ergebnis = await leadsNachStatus(req.params.kampagneId);
    res.json({ erfolg: true, daten: ergebnis });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/leads/:id
leadsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await leadAbrufen(req.params.id);
    res.json({ erfolg: true, daten: lead });
  } catch (fehler) {
    next(fehler);
  }
});

const leadAktualisierenSchema = z.object({
  status: z.string().optional(),
  zugewiesenAn: z.string().uuid().nullable().optional(),
});

// PATCH /api/v1/leads/:id
leadsRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = leadAktualisierenSchema.parse(req.body);
    const lead = await leadAktualisieren(
      req.params.id,
      daten,
      req.benutzer!.benutzerId
    );
    res.json({ erfolg: true, daten: lead });
  } catch (fehler) {
    next(fehler);
  }
});

const notizSchema = z.object({
  inhalt: z.string().min(1, 'Notiz darf nicht leer sein'),
});

// POST /api/v1/leads/:id/notizen
leadsRouter.post('/:id/notizen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { inhalt } = notizSchema.parse(req.body);
    const notiz = await leadNotizHinzufuegen(
      req.params.id,
      inhalt,
      req.benutzer!.benutzerId
    );
    res.status(201).json({ erfolg: true, daten: notiz });
  } catch (fehler) {
    next(fehler);
  }
});
