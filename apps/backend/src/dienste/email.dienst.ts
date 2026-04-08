import nodemailer from 'nodemailer';
import { prisma } from '../datenbank/prisma.client';
import { variablenAufloesen } from '../hilfsfunktionen/variablen';
import { logger } from '../hilfsfunktionen/logger';
import { integrationKonfigurationLesenMitFallback } from './integrationen.dienst';

interface EmailOptionen {
  an: string;
  betreff: string;
  html: string;
  text?: string;
  /** Wenn gesetzt, wird die SMTP-Konfiguration des Kunden verwendet (Multi-Tenant). */
  kundeId?: string | null;
}

interface SmtpKonfiguration {
  host: string;
  port: number;
  secure: boolean;
  benutzer?: string;
  passwort?: string;
  absenderName: string;
  absenderEmail: string;
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

/**
 * Liest die SMTP-Konfiguration. Erst pro Kunde, dann global, dann ENV-Vars (Backwards-Compat).
 */
async function smtpKonfigurationLesen(kundeId?: string | null): Promise<SmtpKonfiguration | null> {
  // 1. Kunden-spezifische oder globale Integration aus DB
  const konfig = await integrationKonfigurationLesenMitFallback('smtp', kundeId);
  if (konfig?.host) {
    return {
      host: konfig.host,
      port: parseInt(konfig.port || '587', 10),
      secure: konfig.port === '465',
      benutzer: konfig.benutzer || undefined,
      passwort: konfig.passwort || undefined,
      absenderName: konfig.absender_name || 'Axano LeadFlow',
      absenderEmail: konfig.absender_email || konfig.benutzer || 'no-reply@axano.de',
    };
  }

  // 2. Fallback auf ENV-Vars (für initiale Setups ohne Integration in DB)
  const envHost = process.env.SMTP_HOST;
  if (!envHost) return null;
  return {
    host: envHost,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    benutzer: process.env.SMTP_BENUTZER || undefined,
    passwort: process.env.SMTP_PASSWORT || undefined,
    absenderName: process.env.SMTP_ABSENDER_NAME || 'Axano LeadFlow',
    absenderEmail: process.env.SMTP_BENUTZER || 'no-reply@axano.de',
  };
}

function transportErstellen(konfig: SmtpKonfiguration) {
  return nodemailer.createTransport({
    host: konfig.host,
    port: konfig.port,
    secure: konfig.secure,
    // Auth nur wenn Benutzer und Passwort gesetzt (MailHog braucht keine Auth)
    ...(konfig.benutzer && konfig.passwort
      ? { auth: { user: konfig.benutzer, pass: konfig.passwort } }
      : {}),
  });
}

/**
 * Sendet eine E-Mail direkt. Wenn `kundeId` gesetzt ist, wird die SMTP-Konfiguration
 * dieses Kunden verwendet (Multi-Tenant). Sonst global, dann ENV-Fallback.
 */
export async function emailSenden(optionen: EmailOptionen): Promise<boolean> {
  const konfig = await smtpKonfigurationLesen(optionen.kundeId);

  if (!konfig) {
    logger.info('E-Mail (kein SMTP konfiguriert – nur Log):', {
      an: optionen.an,
      betreff: optionen.betreff,
      kundeId: optionen.kundeId,
    });
    return true;
  }

  const transport = transportErstellen(konfig);

  try {
    await transport.sendMail({
      from: `"${konfig.absenderName}" <${konfig.absenderEmail}>`,
      to: optionen.an,
      subject: optionen.betreff,
      html: optionen.html,
      text: optionen.text,
    });

    logger.info(`E-Mail gesendet an ${optionen.an}: ${optionen.betreff}`, {
      kundeId: optionen.kundeId,
      host: konfig.host,
    });
    return true;
  } catch (fehler) {
    logger.error('E-Mail-Versand fehlgeschlagen:', { error: fehler, an: optionen.an, kundeId: optionen.kundeId });
    throw fehler;
  }
}

/**
 * Sendet eine E-Mail basierend auf einem Template mit aufgelösten Variablen.
 * Wenn `kundeId` gesetzt ist, wird der SMTP-Server dieses Kunden verwendet.
 */
export async function emailMitTemplateSenden(
  templateId: string,
  lead: LeadFuerEmail,
  anEmail?: string,
  kundeId?: string | null
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

  return emailSenden({ an: empfaenger, betreff, html, text, kundeId });
}
