import crypto from 'crypto';
import { logger } from '../hilfsfunktionen/logger';
import { prisma } from '../datenbank/prisma.client';

/**
 * Offizielle Meta WhatsApp Business Cloud API – direkter Draht zur Graph API.
 * Parallel zu whatsapp.dienst.ts (Superchat). Welcher Anbieter genutzt wird,
 * steuert das Feld Kampagne.whatsappAnbieter ("superchat" | "meta").
 */

export interface MetaWhatsAppBusinessAccount {
  id: string;
  name: string;
}

export interface MetaWhatsAppPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating?: string;
  code_verification_status?: string;
}

export interface MetaWhatsAppTemplateKomponente {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  text?: string;
  example?: { body_text?: string[][]; header_text?: string[] };
  buttons?: Array<{ type: string; text?: string; url?: string }>;
}

export interface MetaWhatsAppTemplate {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  category: string;
  language: string;
  components: MetaWhatsAppTemplateKomponente[];
}

const GRAPH_BASIS = 'https://graph.facebook.com/v18.0';

// ─────────────────────────────────────────────────────────
// WABA-, PhoneNumber- und Template-Abfrage
// ─────────────────────────────────────────────────────────

/**
 * Ermittelt alle WhatsApp Business Accounts (WABAs), die ueber die Business Manager
 * des verbundenen Users erreichbar sind.
 */
export async function metaWabaListeAbrufen(userZugriffstoken: string): Promise<MetaWhatsAppBusinessAccount[]> {
  const ergebnis: MetaWhatsAppBusinessAccount[] = [];
  try {
    const bizAntwort = await fetch(
      `${GRAPH_BASIS}/me/businesses?access_token=${userZugriffstoken}&fields=id,name&limit=50`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!bizAntwort.ok) return ergebnis;

    const bizJson = await bizAntwort.json() as { data?: Array<{ id: string; name: string }> };
    const businesses = bizJson.data || [];

    for (const biz of businesses) {
      // Pro Business: owned WABAs + shared WABAs (fuer Agenturen)
      const ownedUrl = `${GRAPH_BASIS}/${biz.id}/owned_whatsapp_business_accounts?access_token=${userZugriffstoken}&fields=id,name&limit=50`;
      const sharedUrl = `${GRAPH_BASIS}/${biz.id}/client_whatsapp_business_accounts?access_token=${userZugriffstoken}&fields=id,name&limit=50`;

      for (const url of [ownedUrl, sharedUrl]) {
        try {
          const antwort = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!antwort.ok) continue;
          const json = await antwort.json() as { data?: Array<{ id: string; name: string }> };
          for (const waba of json.data || []) {
            if (!ergebnis.some((w) => w.id === waba.id)) {
              ergebnis.push(waba);
            }
          }
        } catch (fehler) {
          logger.warn('Meta WABA-Abfrage fehlgeschlagen', { bizId: biz.id, error: fehler });
        }
      }
    }
  } catch (fehler) {
    logger.error('Meta WABA-Liste konnte nicht abgerufen werden', { error: fehler });
  }
  return ergebnis;
}

/**
 * Liefert alle Telefonnummern eines WABA.
 */
export async function metaPhoneNumbersAbrufen(
  wabaId: string,
  zugriffstoken: string
): Promise<MetaWhatsAppPhoneNumber[]> {
  try {
    const antwort = await fetch(
      `${GRAPH_BASIS}/${wabaId}/phone_numbers?access_token=${zugriffstoken}&fields=id,display_phone_number,verified_name,quality_rating,code_verification_status&limit=50`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!antwort.ok) {
      const fehlerText = await antwort.text();
      logger.error('Meta phone_numbers-Abruf fehlgeschlagen', { wabaId, body: fehlerText.substring(0, 300) });
      return [];
    }
    const json = await antwort.json() as { data?: MetaWhatsAppPhoneNumber[] };
    return json.data || [];
  } catch (fehler) {
    logger.error('Meta phone_numbers: Netzwerkfehler', { wabaId, error: fehler });
    return [];
  }
}

/**
 * Liefert alle Message-Templates eines WABA.
 * Per Default werden alle zurueckgegeben – die Filterung auf APPROVED
 * erfolgt im Consumer (damit UI-seitig auch Pending/Rejected anzeigbar sind).
 */
export async function metaTemplatesAbrufen(
  wabaId: string,
  zugriffstoken: string
): Promise<MetaWhatsAppTemplate[]> {
  try {
    const antwort = await fetch(
      `${GRAPH_BASIS}/${wabaId}/message_templates?access_token=${zugriffstoken}&fields=id,name,status,category,language,components&limit=100`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!antwort.ok) {
      const fehlerText = await antwort.text();
      logger.error('Meta message_templates-Abruf fehlgeschlagen', { wabaId, body: fehlerText.substring(0, 300) });
      return [];
    }
    const json = await antwort.json() as { data?: MetaWhatsAppTemplate[] };
    return json.data || [];
  } catch (fehler) {
    logger.error('Meta message_templates: Netzwerkfehler', { wabaId, error: fehler });
    return [];
  }
}

// ─────────────────────────────────────────────────────────
// Nachricht senden
// ─────────────────────────────────────────────────────────

export interface MetaTemplateParameter {
  name: string;
  wert: string;
}

/**
 * Sendet eine Template-Nachricht ueber die Meta Cloud API.
 * Die Parameter werden in der Reihenfolge ihres Auftretens im BODY eingesetzt.
 *
 * Meta erwartet: body parameters als Array { type: "text", text: "..." }
 * Die Reihenfolge muss der Platzhalter-Reihenfolge im Template entsprechen.
 */
export async function metaTemplateNachrichtSenden(
  phoneNumberId: string,
  empfaengerTelefon: string,
  templateName: string,
  sprache: string,
  parameter: MetaTemplateParameter[],
  zugriffstoken: string
): Promise<{ erfolg: boolean; fehler?: string; messageId?: string }> {
  const telefonOhnePlus = empfaengerTelefon.replace(/^\+/, '');
  const bodyParameter = parameter.map((p) => ({ type: 'text', text: p.wert }));

  const nachricht = {
    messaging_product: 'whatsapp',
    to: telefonOhnePlus,
    type: 'template',
    template: {
      name: templateName,
      language: { code: sprache },
      components: bodyParameter.length > 0
        ? [{ type: 'body', parameters: bodyParameter }]
        : undefined,
    },
  };

  try {
    const antwort = await fetch(`${GRAPH_BASIS}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${zugriffstoken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(nachricht),
      signal: AbortSignal.timeout(15000),
    });

    if (!antwort.ok) {
      const fehlerText = await antwort.text();
      logger.error('Meta WhatsApp-Versand fehlgeschlagen', {
        phoneNumberId,
        telefon: empfaengerTelefon,
        template: templateName,
        status: antwort.status,
        body: fehlerText.substring(0, 500),
      });
      let fehlerNachricht = `HTTP ${antwort.status}`;
      try {
        const fbJson = JSON.parse(fehlerText) as { error?: { message?: string } };
        if (fbJson.error?.message) fehlerNachricht = fbJson.error.message;
      } catch { /* ignore */ }
      return { erfolg: false, fehler: fehlerNachricht };
    }

    const ergebnis = await antwort.json() as { messages?: Array<{ id: string }> };
    const messageId = ergebnis.messages?.[0]?.id;
    logger.info(`Meta WhatsApp-Template "${templateName}" gesendet an ${empfaengerTelefon} (msg: ${messageId})`);
    return { erfolg: true, messageId };
  } catch (fehler) {
    logger.error('Meta WhatsApp-Versand: Netzwerkfehler', { error: fehler });
    return { erfolg: false, fehler: fehler instanceof Error ? fehler.message : 'Netzwerkfehler' };
  }
}

// ─────────────────────────────────────────────────────────
// Webhook: Signatur, Parsing, Verify-Challenge
// ─────────────────────────────────────────────────────────

/**
 * Prueft die X-Hub-Signature-256 eines eingehenden Meta-Webhooks.
 * Meta signiert den Rohkoerper mit HMAC-SHA256 + App-Secret.
 */
export function metaWebhookSignaturPruefen(
  rohBody: string,
  signaturHeader: string | undefined,
  appSecret: string
): boolean {
  if (!signaturHeader || !signaturHeader.startsWith('sha256=')) return false;
  const erwartete = crypto.createHmac('sha256', appSecret).update(rohBody).digest('hex');
  const eingereicht = signaturHeader.substring(7);
  try {
    return crypto.timingSafeEqual(Buffer.from(erwartete, 'hex'), Buffer.from(eingereicht, 'hex'));
  } catch {
    return false;
  }
}

export interface MetaEingehendeNachricht {
  phoneNumberId: string;
  vonTelefon: string;
  vonName?: string;
  text?: string;
  zeitstempel: Date;
  metaMessageId: string;
  typ: string;
}

/**
 * Parst eine eingehende Meta WhatsApp-Webhook-Payload.
 * Meta schickt pro Event eine Struktur mit entry[].changes[].value.messages[].
 */
export function metaEingehendeNachrichtParsen(body: unknown): MetaEingehendeNachricht[] {
  const nachrichten: MetaEingehendeNachricht[] = [];
  const payload = body as {
    object?: string;
    entry?: Array<{
      changes?: Array<{
        field?: string;
        value?: {
          metadata?: { phone_number_id?: string; display_phone_number?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: Array<{
            from?: string;
            id?: string;
            timestamp?: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };

  if (payload.object !== 'whatsapp_business_account') return nachrichten;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const value = change.value;
      if (!value?.messages || !value.metadata?.phone_number_id) continue;

      for (const msg of value.messages) {
        if (!msg.from || !msg.id) continue;
        const kontakt = value.contacts?.find((c) => c.wa_id === msg.from);
        nachrichten.push({
          phoneNumberId: value.metadata.phone_number_id,
          vonTelefon: '+' + msg.from,
          vonName: kontakt?.profile?.name,
          text: msg.text?.body,
          zeitstempel: new Date(parseInt(msg.timestamp || '0', 10) * 1000),
          metaMessageId: msg.id,
          typ: msg.type || 'unknown',
        });
      }
    }
  }

  return nachrichten;
}

// ─────────────────────────────────────────────────────────
// Antwort-Check fuer Retry-Stopp
// ─────────────────────────────────────────────────────────

/**
 * Prueft, ob der Lead bereits per Meta WhatsApp geantwortet hat.
 * Anders als bei Superchat gibt Meta keine direkte Konversations-API –
 * wir nutzen unsere eigenen LeadAktivitaet-Eintraege mit Typ "whatsapp_empfangen".
 * Diese werden vom Webhook gesetzt.
 */
export async function hatLeadPerWhatsAppMetaGeantwortet(leadId: string): Promise<boolean> {
  try {
    const anzahl = await prisma.leadAktivitaet.count({
      where: {
        leadId,
        typ: 'whatsapp_empfangen',
      },
    });
    return anzahl > 0;
  } catch (fehler) {
    logger.error('Meta WhatsApp-Antwort-Check fehlgeschlagen', { leadId, error: fehler });
    return false;
  }
}
