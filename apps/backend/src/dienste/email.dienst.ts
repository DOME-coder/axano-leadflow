import nodemailer from 'nodemailer';
import { prisma } from '../datenbank/prisma.client';
import { variablenAufloesen } from '../hilfsfunktionen/variablen';
import { logger } from '../hilfsfunktionen/logger';

interface EmailOptionen {
  an: string;
  betreff: string;
  html: string;
  text?: string;
}

interface LeadFuerEmail {
  vorname?: string | null;
  nachname?: string | null;
  email?: string | null;
  telefon?: string | null;
  status: string;
  erstelltAm: Date;
  kampagne?: { name: string } | null;
  zugewiesener?: { vorname: string; nachname?: string } | null;
  felddaten?: Array<{
    feld: { feldname: string };
    wert: string | null;
  }>;
}

function transportErstellen() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  const benutzer = process.env.SMTP_BENUTZER;
  const passwort = process.env.SMTP_PASSWORT;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    // Auth nur wenn Benutzer und Passwort gesetzt (MailHog braucht keine Auth)
    ...(benutzer && passwort ? { auth: { user: benutzer, pass: passwort } } : {}),
  });
}

/**
 * Sendet eine E-Mail direkt.
 */
export async function emailSenden(optionen: EmailOptionen): Promise<boolean> {
  const transport = transportErstellen();

  if (!transport) {
    logger.info('E-Mail (kein SMTP konfiguriert – nur Log):', {
      an: optionen.an,
      betreff: optionen.betreff,
    });
    return true;
  }

  try {
    await transport.sendMail({
      from: `"${process.env.SMTP_ABSENDER_NAME || 'Axano LeadFlow'}" <${process.env.SMTP_BENUTZER}>`,
      to: optionen.an,
      subject: optionen.betreff,
      html: optionen.html,
      text: optionen.text,
    });

    logger.info(`E-Mail gesendet an ${optionen.an}: ${optionen.betreff}`);
    return true;
  } catch (fehler) {
    logger.error('E-Mail-Versand fehlgeschlagen:', { error: fehler, an: optionen.an });
    throw fehler;
  }
}

/**
 * Sendet eine E-Mail basierend auf einem Template mit aufgelösten Variablen.
 */
export async function emailMitTemplateSenden(
  templateId: string,
  lead: LeadFuerEmail,
  anEmail?: string
): Promise<boolean> {
  const template = await prisma.emailTemplate.findUnique({
    where: { id: templateId },
  });

  if (!template) {
    throw new Error(`E-Mail-Template ${templateId} nicht gefunden`);
  }

  const betreff = variablenAufloesen(template.betreff, lead);
  const html = variablenAufloesen(template.htmlInhalt, lead);
  const text = template.textInhalt ? variablenAufloesen(template.textInhalt, lead) : undefined;
  const empfaenger = anEmail ? variablenAufloesen(anEmail, lead) : lead.email;

  if (!empfaenger) {
    throw new Error('Keine E-Mail-Adresse für den Lead vorhanden');
  }

  return emailSenden({ an: empfaenger, betreff, html, text });
}
