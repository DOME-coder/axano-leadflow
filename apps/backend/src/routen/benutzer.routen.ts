import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
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
        kundeId: true,
        kunde: { select: { id: true, name: true } },
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
  rolle: z.enum(['admin', 'mitarbeiter', 'kunde']).default('mitarbeiter'),
  kundeId: z.string().uuid().optional(),
});

// POST /api/v1/benutzer (nur Admin)
// Legt Benutzer direkt mit Passwort an. Fuer Rolle 'kunde' ist kundeId Pflicht —
// der Benutzer ist sofort aktiv und kann sich ohne Einladungs-Mail einloggen.
benutzerRouter.post('/', nurAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = benutzerErstellenSchema.parse(req.body);

    if (daten.rolle === 'kunde' && !daten.kundeId) {
      throw new AppFehler('Fuer Rolle "kunde" ist kundeId erforderlich', 400, 'KUNDE_ID_FEHLT');
    }

    const bestehend = await prisma.benutzer.findUnique({ where: { email: daten.email } });
    if (bestehend) {
      throw new AppFehler('E-Mail-Adresse ist bereits vergeben', 409, 'EMAIL_EXISTIERT');
    }

    if (daten.kundeId) {
      const kunde = await prisma.kunde.findUnique({ where: { id: daten.kundeId } });
      if (!kunde) {
        throw new AppFehler('Kunde nicht gefunden', 404, 'NICHT_GEFUNDEN');
      }
    }

    const passwortHash = await bcrypt.hash(daten.passwort, 12);
    const benutzer = await prisma.benutzer.create({
      data: {
        email: daten.email,
        vorname: daten.vorname,
        nachname: daten.nachname,
        passwortHash,
        rolle: daten.rolle,
        aktiv: true,
        kundeId: daten.rolle === 'kunde' ? daten.kundeId! : null,
      },
      select: {
        id: true,
        email: true,
        vorname: true,
        nachname: true,
        rolle: true,
        aktiv: true,
        kundeId: true,
        kunde: { select: { id: true, name: true } },
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

// PATCH /api/v1/benutzer/profil (eigene Daten)
// WICHTIG: Muss vor /:id registriert werden, sonst fängt /:id diese Anfrage ab
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
// WICHTIG: Muss vor /:id registriert werden, sonst fängt /:id diese Anfrage ab
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

// POST /api/v1/benutzer/:id/passwort-zuruecksetzen (nur Admin)
// Admin setzt fuer einen anderen Benutzer ein neues Passwort. Der Klartext wird
// einmalig zurueckgegeben, damit der Admin ihn dem Benutzer persoenlich weitergeben
// kann. Kein E-Mail-Versand — passt zum restlichen Onboarding-Flow.
const passwortZuruecksetzenSchema = z.object({
  neuesPasswort: z.string().min(8, 'Passwort muss mindestens 8 Zeichen lang sein'),
});
benutzerRouter.post('/:id/passwort-zuruecksetzen', nurAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { neuesPasswort } = passwortZuruecksetzenSchema.parse(req.body);

    if (req.params.id === req.benutzer!.benutzerId) {
      throw new AppFehler('Eigenes Passwort bitte unter /benutzer/passwort aendern', 400, 'SELBST_RESET_NICHT_ERLAUBT');
    }

    const bestehend = await prisma.benutzer.findUnique({ where: { id: req.params.id } });
    if (!bestehend) {
      throw new AppFehler('Benutzer nicht gefunden', 404, 'NICHT_GEFUNDEN');
    }

    const passwortHash = await bcrypt.hash(neuesPasswort, 12);
    await prisma.benutzer.update({
      where: { id: req.params.id },
      data: {
        passwortHash,
        aktiv: true,
        loginVersuche: 0,
        gesperrtBis: null,
      },
    });

    res.json({
      erfolg: true,
      daten: { email: bestehend.email, neuesPasswort },
    });
  } catch (fehler) {
    next(fehler);
  }
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

// DELETE /api/v1/benutzer/:id (nur Admin – echtes Loeschen)
// Entfernt den Benutzer endgueltig. Referenzen in Kampagnen (ersteller),
// Leads (zugewiesener) und LeadNotiz (autor) werden zuvor auf null gesetzt,
// damit keine FK-Constraints verletzt werden. BenutzerEinladung wird via
// onDelete: Cascade automatisch mitgeloescht.
benutzerRouter.delete('/:id', nurAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.benutzer!.benutzerId) {
      throw new AppFehler('Sie koennen sich nicht selbst loeschen', 400, 'SELBST_LOESCHUNG');
    }

    const bestehend = await prisma.benutzer.findUnique({ where: { id: req.params.id } });
    if (!bestehend) {
      throw new AppFehler('Benutzer nicht gefunden', 404, 'NICHT_GEFUNDEN');
    }

    await prisma.$transaction([
      prisma.kampagne.updateMany({ where: { erstelltVon: req.params.id }, data: { erstelltVon: null } }),
      prisma.lead.updateMany({ where: { zugewiesenAn: req.params.id }, data: { zugewiesenAn: null } }),
      prisma.leadNotiz.updateMany({ where: { autorId: req.params.id }, data: { autorId: null } }),
      prisma.benutzer.delete({ where: { id: req.params.id } }),
    ]);

    res.json({ erfolg: true, nachricht: 'Benutzer geloescht' });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/benutzer/einladen (nur Admin)
// Legt einen Kunden-Benutzer an (rolle='kunde', aktiv=false) und versendet Einladungs-E-Mail.
const einladenSchema = z.object({
  email: z.string().email('Ungueltige E-Mail-Adresse'),
  vorname: z.string().min(1, 'Vorname ist erforderlich'),
  nachname: z.string().min(1, 'Nachname ist erforderlich'),
  kundeId: z.string().uuid('Kunden-ID ist erforderlich'),
});

benutzerRouter.post('/einladen', nurAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daten = einladenSchema.parse(req.body);

    const bestehend = await prisma.benutzer.findUnique({ where: { email: daten.email } });
    if (bestehend) {
      throw new AppFehler('E-Mail-Adresse ist bereits vergeben', 409, 'EMAIL_EXISTIERT');
    }

    const kunde = await prisma.kunde.findUnique({ where: { id: daten.kundeId } });
    if (!kunde) {
      throw new AppFehler('Kunde nicht gefunden', 404, 'NICHT_GEFUNDEN');
    }

    // Platzhalter-Passwort (wird beim Einloesen der Einladung ueberschrieben)
    const platzhalterHash = await bcrypt.hash(crypto.randomUUID(), 12);

    const benutzer = await prisma.benutzer.create({
      data: {
        email: daten.email,
        vorname: daten.vorname,
        nachname: daten.nachname,
        passwortHash: platzhalterHash,
        rolle: 'kunde',
        aktiv: false,
        kundeId: daten.kundeId,
      },
      select: {
        id: true,
        email: true,
        vorname: true,
        nachname: true,
        rolle: true,
        aktiv: true,
        kundeId: true,
        kunde: { select: { id: true, name: true } },
        erstelltAm: true,
      },
    });

    const { einladungErstellen, einladungsLinkBauen, emailEinladungSenden } = await import('../dienste/benutzer-einladung.dienst');
    const { klartextToken } = await einladungErstellen(benutzer.id);
    const einladungsLink = einladungsLinkBauen(klartextToken);

    try {
      await emailEinladungSenden(
        { email: benutzer.email, vorname: benutzer.vorname, nachname: benutzer.nachname },
        klartextToken,
        kunde.name,
      );
    } catch (mailFehler) {
      // Mail-Versand gescheitert → Zombie-Records entfernen, damit erneuter
      // Einladungs-Versuch mit derselben E-Mail moeglich ist.
      await prisma.benutzerEinladung.deleteMany({ where: { benutzerId: benutzer.id } });
      await prisma.benutzer.delete({ where: { id: benutzer.id } });
      const nachricht = mailFehler instanceof Error ? mailFehler.message : 'Unbekannter Fehler';
      throw new AppFehler(
        `E-Mail-Versand fehlgeschlagen: ${nachricht}`,
        500,
        'EMAIL_VERSAND_FEHLGESCHLAGEN',
      );
    }

    res.status(201).json({ erfolg: true, daten: { ...benutzer, einladungsLink } });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/benutzer/:id/einladung-neu-senden (nur Admin)
// Erzeugt einen neuen Einladungs-Token (alter wird verworfen) und sendet die
// Einladungs-E-Mail erneut. Nur fuer Kunden-Rolle, die noch nicht aktiv ist.
benutzerRouter.post('/:id/einladung-neu-senden', nurAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const benutzer = await prisma.benutzer.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        vorname: true,
        nachname: true,
        rolle: true,
        aktiv: true,
        kundeId: true,
        kunde: { select: { name: true } },
      },
    });

    if (!benutzer) {
      throw new AppFehler('Benutzer nicht gefunden', 404, 'NICHT_GEFUNDEN');
    }
    if (benutzer.rolle !== 'kunde') {
      throw new AppFehler('Einladungen sind nur fuer Kunden-Benutzer vorgesehen', 400, 'FALSCHE_ROLLE');
    }
    if (benutzer.aktiv) {
      throw new AppFehler('Dieser Benutzer hat seinen Zugang bereits aktiviert', 400, 'BEREITS_AKTIV');
    }

    const { einladungErstellen, einladungsLinkBauen, emailEinladungSenden } = await import('../dienste/benutzer-einladung.dienst');
    const { klartextToken } = await einladungErstellen(benutzer.id);
    const einladungsLink = einladungsLinkBauen(klartextToken);

    try {
      await emailEinladungSenden(
        { email: benutzer.email, vorname: benutzer.vorname, nachname: benutzer.nachname },
        klartextToken,
        benutzer.kunde?.name || null,
      );
    } catch (mailFehler) {
      // Beim Erneuern lassen wir User und Einladung stehen (User existiert ja schon
      // laenger), geben aber die Fehlermeldung zurueck.
      const nachricht = mailFehler instanceof Error ? mailFehler.message : 'Unbekannter Fehler';
      throw new AppFehler(
        `E-Mail-Versand fehlgeschlagen: ${nachricht}`,
        500,
        'EMAIL_VERSAND_FEHLGESCHLAGEN',
      );
    }

    res.json({ erfolg: true, daten: { einladungsLink } });
  } catch (fehler) {
    next(fehler);
  }
});
