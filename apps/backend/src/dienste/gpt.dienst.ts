import { logger } from '../hilfsfunktionen/logger';
import { integrationKonfigurationLesen } from './integrationen.dienst';

type AnrufErgebnis = 'interessiert' | 'nicht_interessiert' | 'voicemail' | 'falsche_nummer' | 'nicht_abgenommen' | 'aufgelegt' | 'hung_up' | 'disconnected';

export interface GptAnalyseErgebnis {
  zusammenfassung: string;
  verdict: string;
  ergebnis: AnrufErgebnis;
}

// Exakter System-Prompt aus PRD
const SYSTEM_PROMPT = 'Du bist ein nützlicher, intelligenter Assistent, spezialisiert auf die Zusammenfassung und Analyse von Gesprächen/Transkripten.';

// Exakter User-Prompt aus CLAUDE_CODE_PROMPT_V2.md
const ANALYSE_PROMPT = `Du erhältst das Transkript eines Telefonats zwischen einem potenziellen Kunden und einem KI-Agenten. Der Anruf wurde vollständig durchgeführt. Fasse auf Deutsch prägnant zusammen was passiert ist.

Berücksichtige:
- Wurden Kontaktdaten gesammelt?
- Wurde ein Termin vereinbart oder abgelehnt?
- Sonstige relevante Infos?

Die Zusammenfassung dient zur internen Dokumentation. Schreibe sachlich, konkret, ohne Füllwörter. Falls du aufzählst welche Daten bestätigt wurden, nenne nur den Datentyp (nicht den Wert).

Gib AUSSCHLIESSLICH dieses JSON zurück:
{
  "summary": "[Zusammenfassung auf Deutsch]",
  "verdict": "[callback scheduled|not interested|wrong number|voicemail|disconnected|hung up]"
}

Verdicts:
- "callback scheduled" = Rückruf vereinbart oder Termin gebucht
- "not interested" = Klar kein Interesse geäußert
- "wrong number" = Falsche Person erreicht
- "voicemail" = Direkt in Mailbox gelaufen
- "disconnected" = Unerwartet unterbrochen
- "hung up" = Sofort aufgelegt ohne echtes Gespräch`;

// Voicemail-Backup-Check Prompt aus CLAUDE_CODE_PROMPT_V2.md
const VOICEMAIL_BACKUP_PROMPT = `Du erhältst ein Transkript. Deine Aufgabe: erkenne ob die Voicemail fälschlicherweise nicht erkannt wurde oder ob tatsächlich ein Gespräch stattfand.

Gib NUR dieses JSON zurück:
{
  "verdict": "voicemail" oder "call"
}

"voicemail" = Es war die Voicemail
"call" = Es hat tatsächlich ein Gespräch stattgefunden`;

// Mapping von GPT-Verdicts auf interne Prisma-Enum-Werte
const verdictMap: Record<string, AnrufErgebnis> = {
  'callback scheduled': 'interessiert',
  'not interested': 'nicht_interessiert',
  'wrong number': 'falsche_nummer',
  'voicemail': 'voicemail',
  'disconnected': 'disconnected',
  'hung up': 'hung_up',
};

/**
 * Analysiert ein Anruf-Transkript mit GPT und gibt Zusammenfassung + Verdict zurück.
 */
export async function transkriptAnalysieren(
  transkript: string,
  endedReason?: string,
  _benutzerdefinierterPrompt?: string
): Promise<GptAnalyseErgebnis> {
  // Schnelle Heuristiken bevor GPT aufgerufen wird
  if (!transkript || transkript.trim().length < 10) {
    if (endedReason === 'customer-did-not-answer' || endedReason === 'no-answer') {
      return { zusammenfassung: 'Niemand hat abgenommen.', verdict: 'hung up', ergebnis: 'nicht_abgenommen' };
    }
    if (endedReason === 'voicemail') {
      return { zusammenfassung: 'Voicemail erreicht, kein Gespräch.', verdict: 'voicemail', ergebnis: 'voicemail' };
    }
    if (endedReason === 'customer-ended-call') {
      return { zusammenfassung: 'Anruf sofort beendet, kein Gespräch.', verdict: 'hung up', ergebnis: 'aufgelegt' };
    }
    return { zusammenfassung: 'Kein Kontakt hergestellt.', verdict: 'hung up', ergebnis: 'nicht_abgenommen' };
  }

  const konfig = await integrationKonfigurationLesen('openai');
  if (!konfig?.api_schluessel) {
    logger.warn('OpenAI API-Key nicht konfiguriert – verwende Heuristik');
    return heuristikAnalyse(transkript, endedReason);
  }

  const modell = konfig.modell || 'gpt-4o-mini';

  try {
    const antwort = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${konfig.api_schluessel}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modell,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${ANALYSE_PROMPT}\n\nTranskript: ${transkript}` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 500,
        temperature: 0,
      }),
    });

    if (!antwort.ok) {
      logger.error('OpenAI API Fehler:', { status: antwort.status });
      return heuristikAnalyse(transkript, endedReason);
    }

    const daten = await antwort.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const rohAntwort = daten.choices[0]?.message?.content;
    if (!rohAntwort) {
      logger.warn('GPT gab leere Antwort zurück');
      return heuristikAnalyse(transkript, endedReason);
    }

    try {
      const gptJson = JSON.parse(rohAntwort) as { summary?: string; verdict?: string };
      const verdict = gptJson.verdict?.toLowerCase().trim() || '';
      const zusammenfassung = gptJson.summary || '';

      const ergebnis = verdictMap[verdict];
      if (ergebnis) {
        logger.info(`GPT-Analyse: ${verdict} → ${ergebnis}`);
        return { zusammenfassung, verdict, ergebnis };
      }

      logger.warn(`GPT gab ungültiges Verdict: "${verdict}" – verwende Heuristik`);
      return heuristikAnalyse(transkript, endedReason);
    } catch {
      logger.warn('GPT-Antwort ist kein gültiges JSON – verwende Heuristik');
      return heuristikAnalyse(transkript, endedReason);
    }
  } catch (fehler) {
    logger.error('GPT-Analyse fehlgeschlagen:', { error: fehler });
    return heuristikAnalyse(transkript, endedReason);
  }
}

/**
 * Voicemail-Backup-Check: Prüft ob ein als Voicemail erkannter Anruf
 * tatsächlich eine Voicemail war oder ein echtes Gespräch.
 */
export async function voicemailBackupCheck(transkript: string): Promise<'voicemail' | 'call'> {
  if (!transkript || transkript.trim().length < 10) {
    return 'voicemail';
  }

  const konfig = await integrationKonfigurationLesen('openai');
  if (!konfig?.api_schluessel) {
    logger.warn('OpenAI API-Key nicht konfiguriert – Voicemail-Backup-Check übersprungen');
    return 'voicemail';
  }

  const modell = konfig.modell || 'gpt-4o-mini';

  try {
    const antwort = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${konfig.api_schluessel}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modell,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${VOICEMAIL_BACKUP_PROMPT}\n\nTranskript: ${transkript}` },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 50,
        temperature: 0,
      }),
    });

    if (!antwort.ok) {
      logger.error('Voicemail-Backup-Check API Fehler:', { status: antwort.status });
      return 'voicemail';
    }

    const daten = await antwort.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    const rohAntwort = daten.choices[0]?.message?.content;
    if (!rohAntwort) return 'voicemail';

    try {
      const gptJson = JSON.parse(rohAntwort) as { verdict?: string };
      const verdict = gptJson.verdict?.toLowerCase().trim();

      if (verdict === 'call') {
        logger.info('Voicemail-Backup-Check: War doch ein echtes Gespräch');
        return 'call';
      }

      logger.info('Voicemail-Backup-Check: Bestätigt als Voicemail');
      return 'voicemail';
    } catch {
      return 'voicemail';
    }
  } catch (fehler) {
    logger.error('Voicemail-Backup-Check fehlgeschlagen:', { error: fehler });
    return 'voicemail';
  }
}

/**
 * Fallback-Heuristik wenn GPT nicht verfügbar ist.
 */
function heuristikAnalyse(transkript: string, endedReason?: string): GptAnalyseErgebnis {
  const text = transkript.toLowerCase();

  if (endedReason === 'voicemail') {
    return { zusammenfassung: 'Voicemail erreicht.', verdict: 'voicemail', ergebnis: 'voicemail' };
  }
  if (endedReason === 'customer-did-not-answer' || endedReason === 'no-answer') {
    return { zusammenfassung: 'Nicht abgenommen.', verdict: 'hung up', ergebnis: 'nicht_abgenommen' };
  }
  if (endedReason === 'customer-ended-call' && text.length < 50) {
    return { zusammenfassung: 'Sofort aufgelegt.', verdict: 'hung up', ergebnis: 'aufgelegt' };
  }

  if (text.includes('falsche nummer') || text.includes('kenne ich nicht') || text.includes('verwählt')) {
    return { zusammenfassung: 'Falsche Nummer – Person ist nicht der gesuchte Kontakt.', verdict: 'wrong number', ergebnis: 'falsche_nummer' };
  }
  if (text.includes('mailbox') || text.includes('voicemail') || text.includes('hinterlassen sie')) {
    return { zusammenfassung: 'Voicemail/Mailbox erreicht.', verdict: 'voicemail', ergebnis: 'voicemail' };
  }
  if (text.includes('termin') || text.includes('interesse') || text.includes('ja gerne') || text.includes('klingt gut')) {
    return { zusammenfassung: 'Person zeigt Interesse, möglicher Termin.', verdict: 'callback scheduled', ergebnis: 'interessiert' };
  }
  if (text.includes('kein interesse') || text.includes('nein danke') || text.includes('nicht interessiert')) {
    return { zusammenfassung: 'Kein Interesse geäußert.', verdict: 'not interested', ergebnis: 'nicht_interessiert' };
  }

  return { zusammenfassung: 'Kein eindeutiges Ergebnis ermittelbar.', verdict: 'hung up', ergebnis: 'nicht_abgenommen' };
}
