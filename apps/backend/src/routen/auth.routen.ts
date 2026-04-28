import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../datenbank/prisma.client';
import { AppFehler } from '../middleware/fehlerbehandlung';
import { authentifizierung } from '../middleware/authentifizierung';
import { logger } from '../hilfsfunktionen/logger';

export const authRouter = Router();

// Brute-Force-Schutz pro IP fuer kostenintensive Anmelde-Endpoints.
// Account-Lockout (5 Fehlversuche → 15 Min) verhindert Single-Account-Brute-Force,
// aber nichts gegen verteilte Account-Enumeration. Daher zusaetzlich ein IP-Limit.
const anmeldeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erfolg: false, fehler: 'Zu viele Anmelde-Versuche – bitte 15 Minuten warten.' },
});

const anmeldeSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  passwort: z.string().min(1, 'Passwort ist erforderlich'),
});

function tokenErstellen(benutzerId: string, email: string, rolle: string, kundeId?: string | null): string {
  const geheimnis = process.env.JWT_GEHEIMNIS;
  if (!geheimnis) throw new AppFehler('Server-Konfigurationsfehler', 500, 'KONFIG_FEHLER');
  const nutzlast: { benutzerId: string; email: string; rolle: string; kundeId?: string } = {
    benutzerId,
    email,
    rolle,
  };
  if (kundeId) nutzlast.kundeId = kundeId;
  return jwt.sign(nutzlast, geheimnis, {
    expiresIn: (process.env.JWT_ABLAUF || '8h') as string & jwt.SignOptions['expiresIn'],
  } as jwt.SignOptions);
}

function refreshTokenErstellen(benutzerId: string): string {
  const geheimnis = process.env.REFRESH_TOKEN_GEHEIMNIS;
  if (!geheimnis) throw new AppFehler('Server-Konfigurationsfehler', 500, 'KONFIG_FEHLER');
  return jwt.sign({ benutzerId }, geheimnis, {
    expiresIn: (process.env.REFRESH_TOKEN_ABLAUF || '30d') as string & jwt.SignOptions['expiresIn'],
  } as jwt.SignOptions);
}

// POST /api/v1/auth/anmelden
authRouter.post('/anmelden', anmeldeLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, passwort } = anmeldeSchema.parse(req.body);

    const benutzer = await prisma.benutzer.findUnique({ where: { email } });
    if (!benutzer) {
      throw new AppFehler('Ungültige Anmeldedaten', 401, 'ANMELDUNG_FEHLGESCHLAGEN');
    }

    if (!benutzer.aktiv) {
      throw new AppFehler('Ihr Konto ist deaktiviert', 403, 'KONTO_DEAKTIVIERT');
    }

    // Sperrung prüfen
    if (benutzer.gesperrtBis && benutzer.gesperrtBis > new Date()) {
      const verbleibendeMinuten = Math.ceil(
        (benutzer.gesperrtBis.getTime() - Date.now()) / 60000
      );
      throw new AppFehler(
        `Konto gesperrt. Versuchen Sie es in ${verbleibendeMinuten} Minuten erneut.`,
        429,
        'KONTO_GESPERRT'
      );
    }

    const passwortKorrekt = await bcrypt.compare(passwort, benutzer.passwortHash);
    if (!passwortKorrekt) {
      const neueVersuche = benutzer.loginVersuche + 1;
      const aktualisierung: { loginVersuche: number; gesperrtBis?: Date } = {
        loginVersuche: neueVersuche,
      };

      // Nach 5 Fehlversuchen für 15 Minuten sperren
      if (neueVersuche >= 5) {
        aktualisierung.gesperrtBis = new Date(Date.now() + 15 * 60 * 1000);
        logger.warn(`Konto gesperrt: ${email} nach ${neueVersuche} Fehlversuchen`);
      }

      await prisma.benutzer.update({
        where: { id: benutzer.id },
        data: aktualisierung,
      });

      throw new AppFehler('Ungültige Anmeldedaten', 401, 'ANMELDUNG_FEHLGESCHLAGEN');
    }

    // Erfolgreiche Anmeldung – Zähler zurücksetzen
    await prisma.benutzer.update({
      where: { id: benutzer.id },
      data: { loginVersuche: 0, gesperrtBis: null, letzterLogin: new Date() },
    });

    const accessToken = tokenErstellen(benutzer.id, benutzer.email, benutzer.rolle, benutzer.kundeId);
    const refreshToken = refreshTokenErstellen(benutzer.id);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Tage
    });

    logger.info(`Benutzer angemeldet: ${email}`);

    // Kunde-Info fuer Frontend (Sidebar zeigt Firmennamen bei Kunden-Rolle)
    let kundeInfo: { id: string; name: string } | null = null;
    if (benutzer.kundeId) {
      const kunde = await prisma.kunde.findUnique({
        where: { id: benutzer.kundeId },
        select: { id: true, name: true },
      });
      if (kunde) kundeInfo = kunde;
    }

    res.json({
      erfolg: true,
      daten: {
        access_token: accessToken,
        benutzer: {
          id: benutzer.id,
          email: benutzer.email,
          vorname: benutzer.vorname,
          nachname: benutzer.nachname,
          rolle: benutzer.rolle,
          kundeId: benutzer.kundeId,
          kunde: kundeInfo,
        },
      },
    });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/auth/token-erneuern
// Bewusst ohne anmeldeLimiter: legitime Nutzer mit mehreren Tabs koennen
// bei kurzlebigen JWTs mehrfach refreshen, der globale 100/min-Limiter aus
// app.ts reicht als Schutz aus.
authRouter.post('/token-erneuern', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      throw new AppFehler('Kein Refresh-Token vorhanden', 401, 'KEIN_REFRESH_TOKEN');
    }

    const geheimnis = process.env.REFRESH_TOKEN_GEHEIMNIS;
    if (!geheimnis) throw new AppFehler('Server-Konfigurationsfehler', 500, 'KONFIG_FEHLER');

    const nutzlast = jwt.verify(refreshToken, geheimnis) as { benutzerId: string };
    const benutzer = await prisma.benutzer.findUnique({
      where: { id: nutzlast.benutzerId },
    });

    if (!benutzer || !benutzer.aktiv) {
      throw new AppFehler('Ungültiger Token', 401, 'TOKEN_UNGUELTIG');
    }

    const neuerAccessToken = tokenErstellen(benutzer.id, benutzer.email, benutzer.rolle, benutzer.kundeId);

    res.json({
      erfolg: true,
      daten: { access_token: neuerAccessToken },
    });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/auth/abmelden
authRouter.post('/abmelden', authentifizierung, (_req: Request, res: Response) => {
  res.clearCookie('refresh_token');
  res.json({ erfolg: true, nachricht: 'Erfolgreich abgemeldet' });
});

// GET /api/v1/auth/einladung-pruefen?token=xxx (public)
// Validiert einen Einladungs-Token und gibt Metadaten zum Kontext zurueck.
// Wird vom Frontend /einladung/[token] Seite aufgerufen, bevor das Passwort-Formular angezeigt wird.
authRouter.get('/einladung-pruefen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    if (!token) {
      res.status(400).json({ erfolg: false, fehler: 'Token fehlt' });
      return;
    }
    const { einladungValidieren } = await import('../dienste/benutzer-einladung.dienst');
    const ergebnis = await einladungValidieren(token);
    if (!ergebnis) {
      res.status(400).json({ erfolg: false, fehler: 'Einladung ist ungueltig, abgelaufen oder bereits eingeloest' });
      return;
    }
    res.json({
      erfolg: true,
      daten: {
        email: ergebnis.benutzer.email,
        vorname: ergebnis.benutzer.vorname,
        kundeName: ergebnis.benutzer.kunde?.name || null,
      },
    });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/auth/einladung-annehmen (public)
// Setzt Passwort, aktiviert Benutzer und logt ihn automatisch ein.
const einladungAnnehmenSchema = z.object({
  token: z.string().min(1, 'Token ist erforderlich'),
  passwort: z.string().min(10, 'Passwort muss mindestens 10 Zeichen lang sein'),
});

authRouter.post('/einladung-annehmen', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, passwort } = einladungAnnehmenSchema.parse(req.body);
    const { einladungEinloesen } = await import('../dienste/benutzer-einladung.dienst');

    let benutzer;
    try {
      benutzer = await einladungEinloesen(token, passwort);
    } catch {
      throw new AppFehler('Einladung ist ungueltig, abgelaufen oder bereits eingeloest', 400, 'EINLADUNG_UNGUELTIG');
    }

    const accessToken = tokenErstellen(benutzer.id, benutzer.email, 'kunde', benutzer.kundeId);
    const refreshToken = refreshTokenErstellen(benutzer.id);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    logger.info(`Einladung eingeloest – Benutzer angemeldet: ${benutzer.email}`);

    res.json({
      erfolg: true,
      daten: {
        access_token: accessToken,
        benutzer: {
          id: benutzer.id,
          email: benutzer.email,
          vorname: benutzer.vorname,
          nachname: benutzer.nachname,
          rolle: 'kunde',
          kundeId: benutzer.kundeId,
          kunde: benutzer.kunde,
        },
      },
    });
  } catch (fehler) {
    next(fehler);
  }
});

// GET /api/v1/auth/profil
authRouter.get('/profil', authentifizierung, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const benutzer = await prisma.benutzer.findUnique({
      where: { id: req.benutzer!.benutzerId },
      select: {
        id: true,
        email: true,
        vorname: true,
        nachname: true,
        rolle: true,
        kundeId: true,
        kunde: { select: { id: true, name: true } },
        letzterLogin: true,
        erstelltAm: true,
      },
    });

    if (!benutzer) {
      throw new AppFehler('Benutzer nicht gefunden', 404, 'NICHT_GEFUNDEN');
    }

    res.json({ erfolg: true, daten: benutzer });
  } catch (fehler) {
    next(fehler);
  }
});
