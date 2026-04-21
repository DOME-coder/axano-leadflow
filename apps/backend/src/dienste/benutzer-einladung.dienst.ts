import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../datenbank/prisma.client';
import { emailSenden } from './email.dienst';
import { logger } from '../hilfsfunktionen/logger';

/**
 * Token-basiertes Einladungs-System fuer Kunden-User.
 *
 * Ablauf:
 * 1. Admin legt Kunden-Benutzer an (rolle='kunde', aktiv=false, kein echtes Passwort).
 * 2. einladungErstellen() erzeugt einen zufaelligen Token, speichert NUR den SHA-256-Hash in DB.
 * 3. emailEinladungSenden() schickt Klartext-Token per E-Mail an den Kunden.
 * 4. Kunde oeffnet Einladungs-Link, setzt sein Passwort.
 * 5. einladungEinloesen() validiert Token, setzt Passwort, aktiviert Benutzer.
 *
 * Sicherheit:
 * - Token nur als Hash in DB (bei DB-Leak kein Klartext).
 * - 7 Tage Gueltigkeit.
 * - Ein-Mal-nutzbar (eingeloestAm-Flag).
 */

const EINLADUNG_GUELTIG_TAGE = 7;

function tokenHashen(klartextToken: string): string {
  return crypto.createHash('sha256').update(klartextToken).digest('hex');
}

/**
 * Erstellt eine neue Einladung fuer einen bestehenden Benutzer.
 * Loescht vorherige Einladungen desselben Benutzers (nur eine aktive gleichzeitig).
 * Gibt den Klartext-Token einmalig zurueck.
 */
export async function einladungErstellen(benutzerId: string): Promise<{ klartextToken: string }> {
  const klartextToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = tokenHashen(klartextToken);
  const ablaufAm = new Date(Date.now() + EINLADUNG_GUELTIG_TAGE * 24 * 60 * 60 * 1000);

  // Falls bereits eine Einladung fuer diesen Benutzer existiert, loeschen
  await prisma.benutzerEinladung.deleteMany({ where: { benutzerId } });

  await prisma.benutzerEinladung.create({
    data: {
      benutzerId,
      tokenHash,
      ablaufAm,
    },
  });

  logger.info(`Einladung erstellt fuer Benutzer ${benutzerId}`);
  return { klartextToken };
}

export interface EinladungsDaten {
  benutzer: {
    id: string;
    email: string;
    vorname: string;
    nachname: string;
    kundeId: string | null;
    kunde: { id: string; name: string } | null;
  };
  einladungId: string;
}

/**
 * Validiert einen Klartext-Token. Gibt Benutzer-Daten zurueck wenn gueltig, sonst null.
 * Prueft: Token existiert + nicht abgelaufen + nicht eingeloest.
 */
export async function einladungValidieren(klartextToken: string): Promise<EinladungsDaten | null> {
  const tokenHash = tokenHashen(klartextToken);
  const einladung = await prisma.benutzerEinladung.findUnique({
    where: { tokenHash },
    include: {
      benutzer: {
        select: {
          id: true,
          email: true,
          vorname: true,
          nachname: true,
          kundeId: true,
          kunde: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!einladung) return null;
  if (einladung.eingeloestAm) return null;
  if (einladung.ablaufAm < new Date()) return null;

  return {
    benutzer: einladung.benutzer,
    einladungId: einladung.id,
  };
}

/**
 * Loest eine Einladung ein: Passwort setzen, Benutzer aktivieren, Einladung markieren.
 * Wirft Fehler wenn Token ungueltig. Passwort-Mindestlaenge wird hier nicht geprueft
 * (sollte der Route-Handler mit Zod machen).
 */
export async function einladungEinloesen(
  klartextToken: string,
  neuesPasswort: string,
): Promise<EinladungsDaten['benutzer']> {
  const validierung = await einladungValidieren(klartextToken);
  if (!validierung) {
    throw new Error('Einladung ist ungueltig, abgelaufen oder bereits eingeloest');
  }

  const passwortHash = await bcrypt.hash(neuesPasswort, 12);

  await prisma.$transaction([
    prisma.benutzer.update({
      where: { id: validierung.benutzer.id },
      data: {
        passwortHash,
        aktiv: true,
        loginVersuche: 0,
        gesperrtBis: null,
      },
    }),
    prisma.benutzerEinladung.update({
      where: { id: validierung.einladungId },
      data: { eingeloestAm: new Date() },
    }),
  ]);

  logger.info(`Einladung eingeloest fuer Benutzer ${validierung.benutzer.id}`);
  return validierung.benutzer;
}

/**
 * Versendet die Einladungs-E-Mail mit dem Klartext-Token als Link.
 */
export async function emailEinladungSenden(
  empfaenger: { email: string; vorname: string; nachname: string },
  klartextToken: string,
  kundeName: string | null,
): Promise<void> {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const einladungsLink = `${frontendUrl}/einladung/${klartextToken}`;
  const anrede = empfaenger.vorname ? `Hallo ${empfaenger.vorname}` : 'Hallo';
  const firmaZeile = kundeName ? `fuer <strong>${kundeName}</strong>` : '';

  const html = `
<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><title>Willkommen bei Axano LeadFlow</title></head>
<body style="font-family: Arial, sans-serif; background: #f5f7fa; margin: 0; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #d5e1ed;">
    <h1 style="color: #1a2b4c; margin-top: 0;">Willkommen bei Axano LeadFlow</h1>
    <p style="color: #2f3542; line-height: 1.6;">${anrede},</p>
    <p style="color: #2f3542; line-height: 1.6;">
      das Axano-Team hat fuer dich einen Zugang ${firmaZeile} eingerichtet. Mit diesem Zugang kannst du
      deine eigenen Integrationen (Facebook, WhatsApp, Google Calendar, Outlook und weitere) direkt
      verbinden — sicher und ohne Passwoerter mit dem Axano-Team zu teilen.
    </p>
    <p style="color: #2f3542; line-height: 1.6; margin-bottom: 24px;">
      Klicke auf den folgenden Button, um dein Passwort zu setzen und deinen Zugang zu aktivieren:
    </p>
    <div style="text-align: center; margin: 32px 0;">
      <a href="${einladungsLink}"
         style="display: inline-block; background: #ff8049; color: #ffffff; text-decoration: none;
                padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px;">
        Passwort setzen &amp; Zugang aktivieren
      </a>
    </div>
    <p style="color: #6b7d94; font-size: 13px; line-height: 1.6;">
      Dieser Link ist <strong>7 Tage</strong> gueltig und kann nur einmal verwendet werden.
      Wenn der Button nicht funktioniert, kopiere diese Adresse in deinen Browser:
    </p>
    <p style="color: #6b7d94; font-size: 12px; word-break: break-all; background: #f5f7fa; padding: 10px; border-radius: 6px;">
      ${einladungsLink}
    </p>
    <hr style="border: none; border-top: 1px solid #e4ecf4; margin: 32px 0 16px;">
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">
      Falls du diese E-Mail unerwartet erhalten hast, kannst du sie einfach ignorieren.
      Der Zugang wird ohne Aktivierung nicht nutzbar.
    </p>
  </div>
</body>
</html>`.trim();

  const text = [
    `${anrede},`,
    '',
    `das Axano-Team hat fuer dich einen Zugang ${kundeName ? `fuer ${kundeName}` : ''} eingerichtet.`,
    'Bitte aktiviere deinen Zugang unter folgendem Link:',
    '',
    einladungsLink,
    '',
    'Der Link ist 7 Tage gueltig und nur einmal nutzbar.',
    '',
    '— Axano LeadFlow',
  ].join('\n');

  await emailSenden({
    an: empfaenger.email,
    betreff: `Dein Zugang zu Axano LeadFlow${kundeName ? ` fuer ${kundeName}` : ''}`,
    html,
    text,
  });

  logger.info(`Einladungs-E-Mail versendet an ${empfaenger.email}`);
}
