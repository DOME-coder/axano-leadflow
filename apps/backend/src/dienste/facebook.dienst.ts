import { logger } from '../hilfsfunktionen/logger';

interface FacebookLeadDaten {
  vorname?: string;
  nachname?: string;
  email?: string;
  telefon?: string;
  felddaten: Record<string, string>;
}

interface FeldMapping {
  facebookFeldname: string;
  kampagneFeldname: string;
}

/**
 * Wendet die konfigurierten Feldmappings auf die Facebook-Rohdaten an.
 * Standard-Felder (first_name, email, etc.) werden immer extrahiert.
 * Custom Fields werden über die mappings aufgelöst.
 */
function feldMappingsAnwenden(
  feldWerte: Record<string, string>,
  mappings?: FeldMapping[]
): Record<string, string> {
  const gemappteFelder: Record<string, string> = {};

  if (mappings && mappings.length > 0) {
    for (const mapping of mappings) {
      const wert = feldWerte[mapping.facebookFeldname];
      if (wert !== undefined && wert !== '') {
        gemappteFelder[mapping.kampagneFeldname] = wert;
      }
    }
  }

  // Alle Facebook-Felder die nicht gemappt wurden auch übernehmen (als Fallback)
  for (const [schluessel, wert] of Object.entries(feldWerte)) {
    if (!gemappteFelder[schluessel] && wert) {
      gemappteFelder[schluessel] = wert;
    }
  }

  return gemappteFelder;
}

/**
 * Ruft Lead-Daten von der Facebook Graph API ab.
 * Facebook Webhooks senden nur die leadgen_id – die Felddaten müssen per API geladen werden.
 */
export async function facebookLeadAbrufen(
  leadgenId: string,
  zugriffstoken: string,
  feldMappings?: FeldMapping[]
): Promise<FacebookLeadDaten> {
  const url = `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${zugriffstoken}&fields=field_data,created_time`;

  try {
    const antwort = await fetch(url, {
      signal: AbortSignal.timeout(10000), // 10 Sekunden Timeout
    });

    if (!antwort.ok) {
      const fehler = await antwort.text();
      logger.error(`Facebook Graph API Fehler: ${antwort.status}`, { fehler, leadgenId });
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

    const gemappteFelder = feldMappingsAnwenden(feldWerte, feldMappings);

    return {
      vorname: feldWerte.first_name || feldWerte.vorname,
      nachname: feldWerte.last_name || feldWerte.nachname,
      email: feldWerte.email,
      telefon: feldWerte.phone_number || feldWerte.telefon,
      felddaten: gemappteFelder,
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
  fieldData: Array<{ name: string; values: string[] }>,
  feldMappings?: FeldMapping[]
): FacebookLeadDaten {
  const feldWerte: Record<string, string> = {};
  for (const feld of fieldData) {
    feldWerte[feld.name] = feld.values?.[0] || '';
  }

  const gemappteFelder = feldMappingsAnwenden(feldWerte, feldMappings);

  return {
    vorname: feldWerte.first_name || feldWerte.vorname,
    nachname: feldWerte.last_name || feldWerte.nachname,
    email: feldWerte.email,
    telefon: feldWerte.phone_number || feldWerte.telefon,
    felddaten: gemappteFelder,
  };
}
