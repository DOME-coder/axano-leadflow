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
 * Tritt auf, wenn der Page Access Token abgelaufen oder invalidiert ist.
 * Der Aufrufer kann darauf reagieren (z.B. Token via user_access_token erneuern).
 */
export class FacebookTokenInvalidFehler extends Error {
  constructor(public readonly leadgenId: string, public readonly fbCode?: number) {
    super(`Facebook Page Access Token ungueltig (leadgen ${leadgenId}, fb_code ${fbCode ?? '?'})`);
    this.name = 'FacebookTokenInvalidFehler';
  }
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
 *
 * Wirft FacebookTokenInvalidFehler bei 401 / OAuthException (Code 190),
 * damit der Aufrufer den Token erneuern oder Admin benachrichtigen kann.
 */
export async function facebookLeadAbrufen(
  leadgenId: string,
  zugriffstoken: string,
  feldMappings?: FeldMapping[]
): Promise<FacebookLeadDaten> {
  const url = `https://graph.facebook.com/v18.0/${leadgenId}?access_token=${zugriffstoken}&fields=field_data,created_time`;

  const antwort = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  }).catch((netzFehler) => {
    logger.error('Facebook Graph API Netzwerkfehler', { leadgenId, error: netzFehler instanceof Error ? netzFehler.message : netzFehler });
    throw netzFehler;
  });

  if (!antwort.ok) {
    const rohText = await antwort.text();
    let fbFehlerCode: number | undefined;
    let fbFehlerNachricht: string | undefined;
    try {
      const json = JSON.parse(rohText) as { error?: { code?: number; message?: string; type?: string } };
      fbFehlerCode = json.error?.code;
      fbFehlerNachricht = json.error?.message;
    } catch {
      /* nicht-JSON Body, weiter mit Roh-Text */
    }

    const istTokenFehler =
      antwort.status === 401 ||
      fbFehlerCode === 190 || // OAuthException – Token expired/invalid
      fbFehlerCode === 102 || // Session has expired
      fbFehlerCode === 463;   // Session expired

    logger.error('Facebook Graph API Fehler', {
      status: antwort.status,
      fbFehlerCode,
      fbFehlerNachricht: fbFehlerNachricht ?? rohText.slice(0, 200),
      leadgenId,
      tokenInvalid: istTokenFehler,
    });

    if (istTokenFehler) {
      throw new FacebookTokenInvalidFehler(leadgenId, fbFehlerCode);
    }
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
}

/**
 * Versucht, mit einem User-Access-Token (Long-Lived) den Page-Access-Token fuer eine
 * Facebook-Page neu zu holen. Gibt das neue Token zurueck oder null, wenn nicht moeglich.
 */
export async function facebookPageTokenErneuern(
  pageId: string,
  userZugriffstoken: string,
): Promise<string | null> {
  const url = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userZugriffstoken}`;
  try {
    const antwort = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!antwort.ok) {
      const text = await antwort.text();
      logger.error('Facebook Token-Refresh fehlgeschlagen', {
        status: antwort.status,
        body: text.slice(0, 200),
        pageId,
      });
      return null;
    }
    const json = await antwort.json() as { data?: Array<{ id: string; access_token: string }> };
    const treffer = json.data?.find((p) => p.id === pageId);
    if (!treffer) {
      logger.warn('Facebook Token-Refresh: Page-ID nicht in /me/accounts gefunden', { pageId });
      return null;
    }
    return treffer.access_token;
  } catch (fehler) {
    logger.error('Facebook Token-Refresh Netzwerkfehler', {
      pageId,
      error: fehler instanceof Error ? fehler.message : fehler,
    });
    return null;
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
