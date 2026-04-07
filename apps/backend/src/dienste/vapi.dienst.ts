import { logger } from '../hilfsfunktionen/logger';
import { integrationKonfigurationLesenMitFallback } from './integrationen.dienst';

interface VapiAnrufAntwort {
  id: string;
  status: string;
}

/**
 * Liest den VAPI API-Key (pro Kunde oder global).
 */
async function vapiApiKeyLesen(kundeId?: string | null): Promise<string> {
  const konfig = await integrationKonfigurationLesenMitFallback('vapi', kundeId);
  if (!konfig?.api_schluessel) {
    throw new Error('VAPI API-Schlüssel ist nicht konfiguriert. Bitte unter Einstellungen → Integrationen eintragen.');
  }
  return konfig.api_schluessel;
}

/**
 * Startet einen VAPI AI-Anruf.
 */
export async function vapiAnrufStarten(
  telefon: string,
  assistantId: string,
  telefonNummerId: string,
  kundeName?: string,
  metadata?: Record<string, string>,
  assistantOverrides?: Record<string, unknown>,
  kundeId?: string | null
): Promise<string> {
  const apiKey = await vapiApiKeyLesen(kundeId);

  const body: Record<string, unknown> = {
    assistantId,
    phoneNumberId: telefonNummerId,
    customer: {
      number: telefon,
      name: kundeName,
    },
    metadata,
  };

  if (assistantOverrides) {
    body.assistantOverrides = assistantOverrides;
  }

  try {
    const antwort = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!antwort.ok) {
      const fehlerText = await antwort.text();
      logger.error('VAPI Anruf-Start fehlgeschlagen:', {
        status: antwort.status,
        fehler: fehlerText,
        telefon,
      });
      throw new Error(`VAPI API Fehler ${antwort.status}: ${fehlerText}`);
    }

    const daten = await antwort.json() as VapiAnrufAntwort;
    logger.info(`VAPI Anruf gestartet: ${daten.id} an ${telefon}`);
    return daten.id;
  } catch (fehler) {
    logger.error('VAPI Anruf fehlgeschlagen:', { telefon, error: fehler });
    throw fehler;
  }
}

/**
 * Ruft den Status eines VAPI-Anrufs ab.
 */
export async function vapiAnrufAbrufen(callId: string, kundeId?: string | null): Promise<{
  status: string;
  endedReason?: string;
  transcript?: string;
  summary?: string;
  duration?: number;
  recordingUrl?: string;
}> {
  const apiKey = await vapiApiKeyLesen(kundeId);

  const antwort = await fetch(`https://api.vapi.ai/call/${callId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!antwort.ok) {
    throw new Error(`VAPI API Fehler ${antwort.status}`);
  }

  const daten = await antwort.json() as Record<string, unknown>;

  return {
    status: daten.status as string,
    endedReason: daten.endedReason as string | undefined,
    transcript: daten.transcript as string | undefined,
    summary: daten.summary as string | undefined,
    duration: daten.duration as number | undefined,
    recordingUrl: daten.recordingUrl as string | undefined,
  };
}
