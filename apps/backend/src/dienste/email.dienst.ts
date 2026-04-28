import crypto from 'crypto';
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
  /**
   * Wenn gesetzt: Lead-Bezug. Bewirkt Pflicht-Abmelde-Header + Abmelde-Footer im HTML
   * (TMG §7 / DSGVO Art. 21). Wenn der Lead bereits abgemeldet ist, wird die Mail
   * NICHT verschickt und die Funktion gibt false zurueck.
   *
   * Bei Admin-/System-Mails (z.B. Calendly-Fallback an Axano-Team) Feld weglassen
   * — dort gilt die Pflicht nicht.
   */
  leadId?: string | null;
}

/**
 * Erzeugt einen kryptographisch starken, URL-tauglichen Abmelde-Token.
 */
function abmeldeTokenErzeugen(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Stellt sicher, dass der Lead einen Abmelde-Token hat. Generiert lazy einen, falls noch keiner existiert.
 * Gibt das aktuelle Lead-Objekt mit Token + Abmelde-Status zurueck.
 */
async function leadAbmeldeStatusLaden(leadId: string): Promise<{
  emailAbmeldeToken: string;
  emailAbgemeldetAm: Date | null;
} | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { id: true, emailAbmeldeToken: true, emailAbgemeldetAm: true },
  });
  if (!lead) return null;

  if (lead.emailAbmeldeToken) {
    return { emailAbmeldeToken: lead.emailAbmeldeToken, emailAbgemeldetAm: lead.emailAbgemeldetAm };
  }

  // Lazy-Generierung: bestehende Leads haben noch keinen Token.
  const neuerToken = abmeldeTokenErzeugen();
  const aktualisiert = await prisma.lead.update({
    where: { id: leadId },
    data: { emailAbmeldeToken: neuerToken },
    select: { emailAbmeldeToken: true, emailAbgemeldetAm: true },
  });
  return {
    emailAbmeldeToken: aktualisiert.emailAbmeldeToken!,
    emailAbgemeldetAm: aktualisiert.emailAbgemeldetAm,
  };
}

/**
 * Baut die Abmelde-URL fuer einen Lead. Frontend-Route, da Bestaetigungsseite nutzerfreundlicher
 * als ein API-Endpoint mit JSON-Antwort.
 */
function abmeldeUrlBauen(token: string): string {
  const basis = (process.env.FRONTEND_URL || '').replace(/\/$/, '') || 'https://leadflow.axano.com';
  return `${basis}/abmelden/${token}`;
}

/**
 * Haengt einen DSGVO/TMG-konformen Abmelde-Footer an das HTML an, ueberspringt es aber
 * wenn das Template offensichtlich schon einen Abmeldelink enthaelt (z.B. {{abmeldelink}}-Variable).
 */
function abmeldeFooterEinfuegen(html: string, abmeldeUrl: string): string {
  if (html.includes(abmeldeUrl) || /abmelden|unsubscribe/i.test(html)) {
    return html;
  }
  const footer = `
    <hr style="margin-top: 32px; border: none; border-top: 1px solid #e5e7eb;" />
    <p style="font-size: 11px; color: #6b7280; margin-top: 12px; line-height: 1.5;">
      Sie erhalten diese E-Mail, weil Sie Interesse an unserem Angebot bekundet haben.
      Wenn Sie keine weiteren E-Mails von uns erhalten möchten, können Sie sich
      <a href="${abmeldeUrl}" style="color: #6b7280; text-decoration: underline;">hier abmelden</a>.
    </p>
  `;
  // Wenn HTML mit </body> endet, davor einfuegen, sonst einfach anhaengen
  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`);
  }
  return `${html}${footer}`;
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
  kampagne?: { name: string; calendlyLink?: string | null } | null;
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
    // STARTTLS fuer Port 587 (viele Provider brauchen das)
    ...(!konfig.secure && konfig.port === 587 ? { requireTLS: true } : {}),
    // Timeouts damit der Worker nicht ewig haengt
    connectionTimeout: 10000, // 10 Sek fuer TCP-Connect
    greetingTimeout: 10000,   // 10 Sek fuer SMTP-Greeting
    socketTimeout: 15000,     // 15 Sek fuer Daten-Transfer
    // Auth nur wenn Benutzer und Passwort gesetzt
    ...(konfig.benutzer && konfig.passwort
      ? { auth: { user: konfig.benutzer, pass: konfig.passwort } }
      : {}),
    // Debug-Logging fuer SMTP-Probleme
    logger: process.env.NODE_ENV !== 'production',
    debug: process.env.NODE_ENV !== 'production',
  });
}

/**
 * Sendet eine E-Mail direkt. Wenn `kundeId` gesetzt ist, wird die SMTP-Konfiguration
 * dieses Kunden verwendet (Multi-Tenant). Sonst global, dann ENV-Fallback.
 *
 * Wenn `leadId` gesetzt ist, wird der Abmelde-Status geprueft (skip wenn abgemeldet)
 * und ein DSGVO/TMG-konformer Abmelde-Footer + List-Unsubscribe-Header hinzugefuegt.
 *
 * @returns true bei erfolgreichem Versand, false wenn Lead abgemeldet (kein Versand)
 */
export async function emailSenden(optionen: EmailOptionen): Promise<boolean> {
  // 1. Abmelde-Pruefung (nur wenn Lead-Bezug gegeben)
  let abmeldeUrl: string | null = null;
  if (optionen.leadId) {
    const status = await leadAbmeldeStatusLaden(optionen.leadId);
    if (!status) {
      logger.warn(`E-Mail-Versand abgebrochen: Lead ${optionen.leadId} nicht gefunden`);
      return false;
    }
    if (status.emailAbgemeldetAm) {
      logger.info(`E-Mail-Versand uebersprungen: Lead ${optionen.leadId} hat sich abgemeldet`);
      return false;
    }
    abmeldeUrl = abmeldeUrlBauen(status.emailAbmeldeToken);
  }

  const konfig = await smtpKonfigurationLesen(optionen.kundeId);

  if (!konfig) {
    // In Produktion: hart fehlschlagen, damit Aufrufer (z.B. Follow-up-Job) den
    // Fehler sehen und nicht glauben, die Mail sei raus. In Development: nur loggen,
    // damit lokale Entwicklung ohne SMTP-Setup moeglich bleibt.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        `E-Mail-Versand an ${optionen.an} fehlgeschlagen: Kein SMTP konfiguriert. ` +
        `Bitte unter /einstellungen/integrationen → SMTP einrichten oder SMTP_HOST in ENV setzen.`,
      );
    }
    logger.info('E-Mail (kein SMTP konfiguriert – nur Log):', {
      betreff: optionen.betreff,
      kundeId: optionen.kundeId,
      leadId: optionen.leadId,
    });
    return true;
  }

  const transport = transportErstellen(konfig);

  // HTML mit Abmelde-Footer anreichern, wenn Lead-Mail
  const finalesHtml = abmeldeUrl ? abmeldeFooterEinfuegen(optionen.html, abmeldeUrl) : optionen.html;

  // List-Unsubscribe-Header (RFC 2369) — Pflicht fuer Werbe-Mails an Verbraucher
  const headers: Record<string, string> = {};
  if (abmeldeUrl) {
    headers['List-Unsubscribe'] = `<${abmeldeUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  try {
    await transport.sendMail({
      from: `"${konfig.absenderName}" <${konfig.absenderEmail}>`,
      to: optionen.an,
      subject: optionen.betreff,
      html: finalesHtml,
      text: optionen.text,
      headers,
    });

    logger.info(`E-Mail gesendet: ${optionen.betreff}`, {
      kundeId: optionen.kundeId,
      leadId: optionen.leadId,
      host: konfig.host,
    });
    return true;
  } catch (fehler) {
    logger.error('E-Mail-Versand fehlgeschlagen:', {
      error: fehler instanceof Error ? fehler.message : fehler,
      kundeId: optionen.kundeId,
      leadId: optionen.leadId,
    });
    throw fehler;
  }
}

/**
 * Markiert einen Lead als abgemeldet (per Token aus dem Abmelde-Link).
 * Idempotent: mehrfacher Aufruf ist OK, bleibt abgemeldet.
 *
 * @returns Lead-Daten fuer Bestaetigungsseite oder null wenn Token unbekannt
 */
export async function leadPerTokenAbmelden(token: string): Promise<{
  bereitsAbgemeldet: boolean;
  email: string | null;
} | null> {
  const lead = await prisma.lead.findUnique({
    where: { emailAbmeldeToken: token },
    select: { id: true, email: true, emailAbgemeldetAm: true },
  });
  if (!lead) return null;

  if (lead.emailAbgemeldetAm) {
    return { bereitsAbgemeldet: true, email: lead.email };
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: { emailAbgemeldetAm: new Date() },
  });
  await prisma.leadAktivitaet.create({
    data: {
      leadId: lead.id,
      typ: 'manuell',
      beschreibung: 'Lead hat sich von E-Mails abgemeldet (Klick auf Abmelde-Link)',
    },
  });
  logger.info(`Lead ${lead.id} hat sich von E-Mails abgemeldet`);
  return { bereitsAbgemeldet: false, email: lead.email };
}

/**
 * Sendet eine E-Mail basierend auf einem Template mit aufgelösten Variablen.
 * Wenn `kundeId` gesetzt ist, wird der SMTP-Server dieses Kunden verwendet.
 * Wenn `leadId` gesetzt ist, wird Abmelde-Status geprueft + List-Unsubscribe-Header gesetzt.
 */
export async function emailMitTemplateSenden(
  templateId: string,
  lead: LeadFuerEmail & { id?: string },
  anEmail?: string,
  kundeId?: string | null,
  leadId?: string | null,
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

  // leadId aus dem Lead ableiten, falls nicht explizit uebergeben
  const finaleLeadId = leadId ?? lead.id ?? null;

  return emailSenden({ an: empfaenger, betreff, html, text, kundeId, leadId: finaleLeadId });
}
