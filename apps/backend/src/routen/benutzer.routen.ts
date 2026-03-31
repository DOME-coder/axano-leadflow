import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { prisma } from '../datenbank/prisma.client';
import { authentifizierung, nurAdmin } from '../middleware/authentifizierung';
import { AppFehler } from '../middleware/fehlerbehandlung';

export const benutzerRouter = Router();
benutzerRouter.use(authentifizierung);

// GET /api/v1/benutzer (nur Admin)
benutzerRouter.get('/', nurAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const benutzer = await prisma.benutzer.findMany({
      select: {
        id: true,
        email: true,
        vorname: true,
        nachname: true,
        rolle: true,
        aktiv: true,
        letzterLogin: true,
        erstelltAm: true,
      },
      orderBy: { erstelltAm: 'desc' },
    });
    res.json({ erfolg: true, daten: benutzer });
  } catch (fehler) {
    next(fehler);
  }
});

const benutzerErstellenSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  vorname: z.string().min(1, 'Vorname ist erforderlich'),
  nachname: z.string().min(1, 'Nachname ist erforderlich'),
  passwort: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
  rolle: z.enum(['admin', 'mitarbeiter']).default('mitarbeiter'),
});

// POST /api/v1/benutzer (nur Admin)
benutzerRouter.post('/', nurAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = benutzerErstellenSchema.parse(req.body);

    const bestehend = await prisma.benutzer.findUnique({ where: { email: daten.email } });
    if (bestehend) {
      throw new AppFehler('E-Mail-Adresse ist bereits vergeben', 409, 'EMAIL_EXISTIERT');
    }

    const passwortHash = await bcrypt.hash(daten.passwort, 12);
    const benutzer = await prisma.benutzer.create({
      data: {
        email: daten.email,
        vorname: daten.vorname,
        nachname: daten.nachname,
        passwortHash,
        rolle: daten.rolle,
      },
      select: {
        id: true,
        email: true,
        vorname: true,
        nachname: true,
        rolle: true,
        aktiv: true,
        erstelltAm: true,
      },
    });

    res.status(201).json({ erfolg: true, daten: benutzer });
  } catch (fehler) {
    next(fehler);
  }
});

const benutzerAktualisierenSchema = z.object({
  rolle: z.enum(['admin', 'mitarbeiter']).optional(),
  aktiv: z.boolean().optional(),
});

// PATCH /api/v1/benutzer/:id (nur Admin)
benutzerRouter.patch('/:id', nurAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = benutzerAktualisierenSchema.parse(req.body);
    const benutzer = await prisma.benutzer.update({
      where: { id: req.params.id },
      data: daten,
      select: {
        id: true,
        email: true,
        vorname: true,
        nachname: true,
        rolle: true,
        aktiv: true,
        erstelltAm: true,
      },
    });
    res.json({ erfolg: true, daten: benutzer });
  } catch (fehler) {
    next(fehler);
  }
});

// DELETE /api/v1/benutzer/:id (nur Admin – deaktivieren)
benutzerRouter.delete('/:id', nurAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.benutzer!.benutzerId) {
      throw new AppFehler('Sie können sich nicht selbst deaktivieren', 400, 'SELBST_DEAKTIVIERUNG');
    }
    await prisma.benutzer.update({
      where: { id: req.params.id },
      data: { aktiv: false },
    });
    res.json({ erfolg: true, nachricht: 'Benutzer deaktiviert' });
  } catch (fehler) {
    next(fehler);
  }
});

// PATCH /api/v1/benutzer/profil (eigene Daten)
benutzerRouter.patch('/profil', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      vorname: z.string().min(1).optional(),
      nachname: z.string().min(1).optional(),
      email: z.string().email().optional(),
    });
    const daten = schema.parse(req.body);
    const benutzer = await prisma.benutzer.update({
      where: { id: req.benutzer!.benutzerId },
      data: daten,
      select: { id: true, email: true, vorname: true, nachname: true, rolle: true },
    });
    res.json({ erfolg: true, daten: benutzer });
  } catch (fehler) {
    next(fehler);
  }
});

// PATCH /api/v1/benutzer/passwort (eigenes Passwort)
benutzerRouter.patch('/passwort', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      altesPasswort: z.string().min(1),
      neuesPasswort: z.string().min(8, 'Neues Passwort muss mindestens 8 Zeichen lang sein'),
    });
    const { altesPasswort, neuesPasswort } = schema.parse(req.body);

    const benutzer = await prisma.benutzer.findUnique({ where: { id: req.benutzer!.benutzerId } });
    if (!benutzer) throw new AppFehler('Benutzer nicht gefunden', 404, 'NICHT_GEFUNDEN');

    const korrekt = await bcrypt.compare(altesPasswort, benutzer.passwortHash);
    if (!korrekt) throw new AppFehler('Altes Passwort ist falsch', 400, 'PASSWORT_FALSCH');

    const neuerHash = await bcrypt.hash(neuesPasswort, 12);
    await prisma.benutzer.update({
      where: { id: req.benutzer!.benutzerId },
      data: { passwortHash: neuerHash },
    });

    res.json({ erfolg: true, nachricht: 'Passwort erfolgreich geändert' });
  } catch (fehler) {
    next(fehler);
  }
});
