import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authentifizierung } from '../middleware/authentifizierung';
import {
  promptVorlagenAuflisten,
  promptVorlageErstellen,
  promptVorlageAbrufen,
  promptVorlageAktualisieren,
  promptVorlageLoeschen,
  aehnlicheVorlagenSuchen,
} from '../dienste/prompt-vorlagen.dienst';

export const promptVorlagenRouter = Router();
promptVorlagenRouter.use(authentifizierung);

const erstellenSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  beschreibung: z.string().optional(),
  branche: z.string().min(1, 'Branche ist erforderlich'),
  produkt: z.string().optional(),
  vapiPrompt: z.string().min(10, 'Prompt ist zu kurz'),
});

const aktualisierenSchema = z.object({
  name: z.string().min(1).optional(),
  beschreibung: z.string().optional().nullable(),
  branche: z.string().min(1).optional(),
  produkt: z.string().optional().nullable(),
  vapiPrompt: z.string().min(10).optional(),
});

// GET /api/v1/prompt-vorlagen/suche?branche=...
promptVorlagenRouter.get('/suche', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branche = typeof req.query.branche === 'string' ? req.query.branche : '';
    const vorlagen = await aehnlicheVorlagenSuchen(branche);
    res.json({ erfolg: true, daten: vorlagen });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/prompt-vorlagen
promptVorlagenRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vorlagen = await promptVorlagenAuflisten({
      branche: typeof req.query.branche === 'string' ? req.query.branche : undefined,
    });
    res.json({ erfolg: true, daten: vorlagen });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/prompt-vorlagen
promptVorlagenRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = erstellenSchema.parse(req.body);
    const vorlage = await promptVorlageErstellen({
      ...daten,
      erstelltVon: req.benutzer!.benutzerId,
    });
    res.status(201).json({ erfolg: true, daten: vorlage });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/prompt-vorlagen/:id
promptVorlagenRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vorlage = await promptVorlageAbrufen(req.params.id);
    res.json({ erfolg: true, daten: vorlage });
  } catch (fehler) {
    next(fehler);
  }
});

// PATCH /api/v1/prompt-vorlagen/:id
promptVorlagenRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = aktualisierenSchema.parse(req.body);
    const vorlage = await promptVorlageAktualisieren(req.params.id, daten);
    res.json({ erfolg: true, daten: vorlage });
  } catch (fehler) {
    next(fehler);
  }
});

// DELETE /api/v1/prompt-vorlagen/:id
promptVorlagenRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await promptVorlageLoeschen(req.params.id);
    res.json({ erfolg: true });
  } catch (fehler) {
    next(fehler);
  }
});
