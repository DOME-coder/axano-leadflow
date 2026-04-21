import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authentifizierung, nurAdminOderMitarbeiter } from '../middleware/authentifizierung';
import {
  automatisierungenAuflisten,
  automatisierungErstellen,
  automatisierungAktualisieren,
  automatisierungLoeschen,
} from '../dienste/automatisierung.dienst';

// Routen unter /api/v1/kampagnen/:kampagneId/automatisierungen
export const kampagneAutomatisierungenRouter = Router({ mergeParams: true });
kampagneAutomatisierungenRouter.use(authentifizierung);
kampagneAutomatisierungenRouter.use(nurAdminOderMitarbeiter);

// Routen unter /api/v1/automatisierungen
export const automatisierungenRouter = Router();
automatisierungenRouter.use(authentifizierung);
automatisierungenRouter.use(nurAdminOderMitarbeiter);

const schrittSchema = z.object({
  reihenfolge: z.number(),
  aktionTyp: z.enum(['email_senden', 'whatsapp_senden', 'status_setzen', 'benachrichtigung', 'warten', 'warten_bis_uhrzeit']),
  konfiguration: z.record(z.unknown()).optional(),
});

const erstellenSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich'),
  beschreibung: z.string().optional(),
  triggerTyp: z.enum(['lead_eingetroffen', 'status_geaendert', 'inaktivitaet', 'zeitplan']),
  triggerKonfiguration: z.record(z.unknown()).optional(),
  bedingungen: z.array(z.object({
    feld: z.string(),
    operator: z.string(),
    wert: z.string().optional(),
  })).optional(),
  schritte: z.array(schrittSchema),
});

const aktualisierenSchema = z.object({
  name: z.string().min(1).optional(),
  beschreibung: z.string().optional(),
  aktiv: z.boolean().optional(),
  triggerKonfiguration: z.record(z.unknown()).optional(),
  bedingungen: z.array(z.object({
    feld: z.string(),
    operator: z.string(),
    wert: z.string().optional(),
  })).optional(),
  schritte: z.array(schrittSchema).optional(),
});

// GET /api/v1/kampagnen/:kampagneId/automatisierungen
kampagneAutomatisierungenRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ergebnis = await automatisierungenAuflisten(req.params.kampagneId);
    res.json({ erfolg: true, daten: ergebnis });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/kampagnen/:kampagneId/automatisierungen
kampagneAutomatisierungenRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = erstellenSchema.parse(req.body);
    const automatisierung = await automatisierungErstellen(req.params.kampagneId, {
      ...daten,
      triggerKonfiguration: daten.triggerKonfiguration as Prisma.InputJsonValue | undefined,
      bedingungen: daten.bedingungen as Prisma.InputJsonValue | undefined,
      schritte: daten.schritte.map((s) => ({
        ...s,
        konfiguration: s.konfiguration as Prisma.InputJsonValue | undefined,
      })),
    });
    res.status(201).json({ erfolg: true, daten: automatisierung });
  } catch (fehler) {
    next(fehler);
  }
});

// PATCH /api/v1/automatisierungen/:id
automatisierungenRouter.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = aktualisierenSchema.parse(req.body);
    const automatisierung = await automatisierungAktualisieren(req.params.id, {
      ...daten,
      triggerKonfiguration: daten.triggerKonfiguration as Prisma.InputJsonValue | undefined,
      bedingungen: daten.bedingungen as Prisma.InputJsonValue | undefined,
      schritte: daten.schritte?.map((s) => ({
        ...s,
        konfiguration: s.konfiguration as Prisma.InputJsonValue | undefined,
      })),
    });
    res.json({ erfolg: true, daten: automatisierung });
  } catch (fehler) {
    next(fehler);
  }
});

// DELETE /api/v1/automatisierungen/:id
automatisierungenRouter.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await automatisierungLoeschen(req.params.id);
    res.json({ erfolg: true, nachricht: 'Automatisierung gelöscht' });
  } catch (fehler) {
    next(fehler);
  }
});
