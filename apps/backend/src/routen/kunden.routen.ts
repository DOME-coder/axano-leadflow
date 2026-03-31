import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authentifizierung } from '../middleware/authentifizierung';
import {
  kundenAuflisten,
  kundeErstellen,
  kundeAbrufen,
  kundeAktualisieren,
  kundeLoeschen,
} from '../dienste/kunden.dienst';

export const kundenRouter = Router();
kundenRouter.use(authentifizierung);

const kundeErstellenSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(255),
  kontaktperson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  telefon: z.string().optional(),
  branche: z.string().optional(),
  notizen: z.string().optional(),
});

const kundeAktualisierenSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  kontaktperson: z.string().optional().nullable(),
  email: z.union([z.string().email(), z.literal(''), z.null()]).optional(),
  telefon: z.string().optional().nullable(),
  branche: z.string().optional().nullable(),
  notizen: z.string().optional().nullable(),
});

// GET /api/v1/kunden
kundenRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ergebnis = await kundenAuflisten({
      suche: typeof req.query.suche === 'string' ? req.query.suche : undefined,
      seite: typeof req.query.seite === 'string' ? parseInt(req.query.seite) : undefined,
      proSeite: typeof req.query.pro_seite === 'string' ? parseInt(req.query.pro_seite) : undefined,
    });
    res.json({ erfolg: true, daten: ergebnis });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/kunden
kundenRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = kundeErstellenSchema.parse(req.body);
    const kunde = await kundeErstellen({
      ...daten,
      erstelltVon: req.benutzer!.benutzerId,
    });
    res.status(201).json({ erfolg: true, daten: kunde });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/kunden/:id
kundenRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const kunde = await kundeAbrufen(req.params.id);
    res.json({ erfolg: true, daten: kunde });
  } catch (fehler) {
    next(fehler);
  }
});

// PATCH /api/v1/kunden/:id
kundenRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = kundeAktualisierenSchema.parse(req.body);
    const kunde = await kundeAktualisieren(req.params.id, daten);
    res.json({ erfolg: true, daten: kunde });
  } catch (fehler) {
    next(fehler);
  }
});

// DELETE /api/v1/kunden/:id
kundenRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await kundeLoeschen(req.params.id);
    res.json({ erfolg: true });
  } catch (fehler) {
    next(fehler);
  }
});
