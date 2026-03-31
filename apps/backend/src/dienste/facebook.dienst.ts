import { logger } from '../hilfsfunktionen/logger';

interface FacebookLeadDaten {
  vorname?: string;
  nachname?: string;
  email?: string;
  telefon?: string;
  felddaten: Record<string, string>;
}

/**
 * Ruft Lead-Daten von der Facebook Graph API ab.
 * Facebook Webhooks senden nur die leadgen_id – die Felddaten müssen per API geladen werden.
 */
export async function facebookLeadAbrufen(
  leadgenId: string,
  zugriffstoken: string
): Promise<FacebookLeadDaten> {
  const url = `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${zugriffstoken}&fields=field_data,created_time`;

  try {
    const antwort = await fetch(url);

    if (!antwort.ok) {
      const fehler = await antwort.text();
      logger.error(`Facebook Graph API Fehler: ${antwort.status}`, { fehler });
      throw new Error(`Facebook API Fehler: ${antwort.status}`);
    }

    const daten = await antwort.json() as {
      field_data?: Array<{ name: string; values: string[] }>;
    };

    const feldWerte: Record<string, string> = {};
    if (daten.field_data) {
      for (const feld of daten.field_data) {
        feldWerte[feld.name] = feld.values?.[0] || '';
      }
    }

    return {
      vorname: feldWerte.first_name || feldWerte.vorname,
      nachname: feldWerte.last_name || feldWerte.nachname,
      email: feldWerte.email,
      telefon: feldWerte.phone_number || feldWerte.telefon,
      felddaten: feldWerte,
    };
  } catch (fehler) {
    logger.error('Facebook Lead-Abruf fehlgeschlagen:', { leadgenId, error: fehler });
    throw fehler;
  }
}

/**
 * Parst Facebook Lead-Daten direkt aus dem Webhook-Payload (Fallback).
 */
export function facebookWebhookPayloadParsen(
  fieldData: Array<{ name: string; values: string[] }>
): FacebookLeadDaten {
  const feldWerte: Record<string, string> = {};
  for (const feld of fieldData) {
    feldWerte[feld.name] = feld.values?.[0] || '';
  }

  return {
    vorname: feldWerte.first_name || feldWerte.vorname,
    nachname: feldWerte.last_name || feldWerte.nachname,
    email: feldWerte.email,
    telefon: feldWerte.phone_number || feldWerte.telefon,
    felddaten: feldWerte,
  };
}
