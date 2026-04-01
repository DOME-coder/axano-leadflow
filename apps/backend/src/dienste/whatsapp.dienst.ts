import { logger } from '../hilfsfunktionen/logger';
import { integrationKonfigurationLesen } from './integrationen.dienst';

interface SuperchatKontakt {
  id: string;
  telefon: string;
  vorname?: string;
  nachname?: string;
  email?: string;
}

interface SuperchatWebhookNachricht {
  event: string;
  data: {
    contact?: {
      id?: string;
      phone?: string;
      name?: string;
      email?: string;
    };
    message?: {
      text?: string;
      type?: string;
    };
    channel?: {
      id?: string;
    };
  };
}

/**
 * Parst eine eingehende Superchat-Webhook-Nachricht und extrahiert Lead-Daten.
 */
export function superchatNachrichtParsen(body: SuperchatWebhookNachricht): {
  vorname?: string;
  nachname?: string;
  telefon?: string;
  email?: string;
  nachricht?: string;
} | null {
  if (body.event !== 'message.received' && body.event !== 'contact.created') {
    return null;
  }

  const kontakt = body.data?.contact;
  if (!kontakt) return null;

  // Name aufteilen
  let vorname: string | undefined;
  let nachname: string | undefined;
  if (kontakt.name) {
    const teile = kontakt.name.trim().split(/\s+/);
    vorname = teile[0];
    nachname = teile.slice(1).join(' ') || undefined;
  }

  return {
    vorname,
    nachname,
    telefon: kontakt.phone,
    email: kontakt.email,
    nachricht: body.data?.message?.text,
  };
}

/**
 * Sucht einen Kontakt in Superchat per Telefonnummer.
 */
export async function superchatKontaktSuchen(
  telefon: string,
  apiSchluessel: string,
  basisUrl: string
): Promise<SuperchatKontakt | null> {
  try {
    const antwort = await fetch(
      `${basisUrl}/v1/contacts?phone=${encodeURIComponent(telefon)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiSchluessel}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!antwort.ok) return null;

    const daten = await antwort.json() as { data?: Array<{ id: string; phone: string }> };
    const kontakt = daten.data?.[0];

    if (!kontakt) return null;

    return {
      id: kontakt.id,
      telefon: kontakt.phone,
    };
  } catch (fehler) {
    logger.error('Superchat-Kontaktsuche fehlgeschlagen:', { telefon, error: fehler });
    return null;
  }
}

/**
 * Erstellt einen Kontakt in Superchat.
 */
export async function superchatKontaktErstellen(
  daten: { telefon: string; vorname?: string; nachname?: string; email?: string },
  apiSchluessel: string,
  basisUrl: string
): Promise<SuperchatKontakt | null> {
  try {
    const antwort = await fetch(`${basisUrl}/v1/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiSchluessel}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: daten.telefon,
        first_name: daten.vorname,
        last_name: daten.nachname,
        email: daten.email,
      }),
    });

    if (!antwort.ok) return null;

    const ergebnis = await antwort.json() as { data: { id: string; phone: string } };
    return {
      id: ergebnis.data.id,
      telefon: ergebnis.data.phone,
    };
  } catch (fehler) {
    logger.error('Superchat-Kontakterstellung fehlgeschlagen:', { error: fehler });
    return null;
  }
}

/**
 * Sendet eine Template-Nachricht über Superchat.
 */
export async function superchatTemplateNachrichtSenden(
  kontaktId: string,
  kanalId: string,
  templateId: string,
  variablen: Array<{ name: string; wert: string }>,
  apiSchluessel: string,
  basisUrl: string
): Promise<boolean> {
  try {
    const antwort = await fetch(`${basisUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiSchluessel}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contact_id: kontaktId,
        channel_id: kanalId,
        template_id: templateId,
        template_variables: variablen.map((v) => ({
          name: v.name,
          value: v.wert,
        })),
      }),
    });

    if (!antwort.ok) {
      const fehler = await antwort.text();
      logger.error('Superchat Template-Versand fehlgeschlagen:', { fehler });
      return false;
    }

    logger.info(`WhatsApp-Template gesendet an Kontakt ${kontaktId}`);
    return true;
  } catch (fehler) {
    logger.error('Superchat-Versand fehlgeschlagen:', { error: fehler });
    return false;
  }
}

/**
 * Prüft ob ein Lead zwischenzeitlich per WhatsApp geantwortet hat.
 * Nutzt Superchat API: Kontakt suchen → Konversationen → time_window.state prüfen.
 */
export async function hatLeadPerWhatsAppGeantwortet(telefon: string): Promise<boolean> {
  try {
    const konfig = await integrationKonfigurationLesen('superchat');
    if (!konfig?.api_schluessel) return false;

    const basisUrl = konfig.basis_url || 'https://api.superchat.de';
    const headers = {
      'Authorization': `Bearer ${konfig.api_schluessel}`,
      'Content-Type': 'application/json',
    };

    // 1. Kontakt suchen
    const kontaktAntwort = await fetch(
      `${basisUrl}/v1/contacts?phone=${encodeURIComponent(telefon)}`,
      { headers }
    );
    if (!kontaktAntwort.ok) return false;

    const kontaktDaten = await kontaktAntwort.json() as { data?: Array<{ id: string }> };
    const kontaktId = kontaktDaten.data?.[0]?.id;
    if (!kontaktId) return false;

    // 2. Konversationen abrufen
    const konvAntwort = await fetch(
      `${basisUrl}/v1/contacts/${kontaktId}/conversations`,
      { headers }
    );
    if (!konvAntwort.ok) return false;

    const konvDaten = await konvAntwort.json() as { data?: Array<{ id: string }> };
    const konvId = konvDaten.data?.[0]?.id;
    if (!konvId) return false;

    // 3. Konversation-Details abrufen
    const detailAntwort = await fetch(
      `${basisUrl}/v1/conversations/${konvId}`,
      { headers }
    );
    if (!detailAntwort.ok) return false;

    const detailDaten = await detailAntwort.json() as { data?: { time_window?: { state?: string } } };
    const zeitfensterStatus = detailDaten.data?.time_window?.state;

    // "closed" = Lead hat geantwortet (Zeitfenster für Antwort ist geschlossen)
    if (zeitfensterStatus === 'closed') {
      logger.info(`WhatsApp-Antwort erkannt für ${telefon} – Retry wird gestoppt`);
      return true;
    }

    return false;
  } catch (fehler) {
    logger.error('WhatsApp-Antwort-Check fehlgeschlagen:', { telefon, error: fehler });
    return false;
  }
}
