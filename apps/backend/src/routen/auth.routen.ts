import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../datenbank/prisma.client';
import { AppFehler } from '../middleware/fehlerbehandlung';
import { authentifizierung } from '../middleware/authentifizierung';
import { logger } from '../hilfsfunktionen/logger';

export const authRouter = Router();

const anmeldeSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  passwort: z.string().min(1, 'Passwort ist erforderlich'),
});

function tokenErstellen(benutzerId: string, email: string, rolle: string): string {
  const geheimnis = process.env.JWT_GEHEIMNIS;
  if (!geheimnis) throw new AppFehler('Server-Konfigurationsfehler', 500, 'KONFIG_FEHLER');
  return jwt.sign({ benutzerId, email, rolle }, geheimnis, {
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
authRouter.post('/anmelden', async (req: Request, res: Response, next: NextFunction) => {
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

    const accessToken = tokenErstellen(benutzer.id, benutzer.email, benutzer.rolle);
    const refreshToken = refreshTokenErstellen(benutzer.id);

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 Tage
    });

    logger.info(`Benutzer angemeldet: ${email}`);

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
        },
      },
    });
  } catch (fehler) {
    next(fehler);
  }
});

// POST /api/v1/auth/token-erneuern
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

    const neuerAccessToken = tokenErstellen(benutzer.id, benutzer.email, benutzer.rolle);

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
