import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../hilfsfunktionen/logger';
import { integrationKonfigurationLesen } from './integrationen.dienst';

type AnrufErgebnis = 'interessiert' | 'rueckruf_geplant' | 'nicht_interessiert' | 'voicemail' | 'falsche_nummer' | 'nicht_abgenommen' | 'aufgelegt' | 'hung_up' | 'disconnected';

export interface GptAnalyseErgebnis {
  zusammenfassung: string;
  verdict: string;
  ergebnis: AnrufErgebnis;
}

const ANALYSE_PROMPT = `Du erhältst das Transkript eines Telefonats zwischen einem potenziellen Kunden und einem KI-Agenten. Der Anruf wurde vollständig durchgeführt. Fasse auf Deutsch prägnant zusammen was passiert ist.

Berücksichtige:
- Wurden Kontaktdaten gesammelt?
- Wurde ein Termin vereinbart oder abgelehnt?
- Sonstige relevante Infos?

Die Zusammenfassung dient zur internen Dokumentation. Schreibe sachlich, konkret, ohne Füllwörter. Falls du aufzählst welche Daten bestätigt wurden, nenne nur den Datentyp (nicht den Wert).

Gib AUSSCHLIESSLICH dieses JSON zurück:
{
  "summary": "[Zusammenfassung auf Deutsch]",
  "verdict": "[appointment booked|callback scheduled|not interested|wrong number|voicemail|disconnected|hung up]"
}

Verdicts:
- "appointment booked" = Termin wurde TATSÄCHLICH gebucht (Datum + Uhrzeit bestätigt und eingetragen)
- "callback scheduled" = Rückruf gewünscht, Interesse vorhanden aber KEIN fester Termin gebucht
- "not interested" = Klar kein Interesse geäußert
- "wrong number" = Falsche Person erreicht
- "voicemail" = Direkt in Mailbox gelaufen
- "disconnected" = Unerwartet unterbrochen
- "hung up" = Sofort aufgelegt ohne echtes Gespräch`;

const VOICEMAIL_BACKUP_PROMPT = `Du erhältst ein Transkript. Deine Aufgabe: erkenne ob die Voicemail fälschlicherweise nicht erkannt wurde oder ob tatsächlich ein Gespräch stattfand.

Gib NUR dieses JSON zurück:
{
  "verdict": "voicemail" oder "call"
}

"voicemail" = Es war die Voicemail
"call" = Es hat tatsächlich ein Gespräch stattgefunden`;

const verdictMap: Record<string, AnrufErgebnis> = {
  'callback scheduled': 'rueckruf_geplant',
  'appointment booked': 'interessiert',
  'not interested': 'nicht_interessiert',
  'wrong number': 'falsche_nummer',
  'voicemail': 'voicemail',
  'disconnected': 'disconnected',
  'hung up': 'hung_up',
};

/**
 * Erstellt einen Anthropic Client (aus Integrations-Config oder Umgebungsvariable).
 */
async function claudeClientErstellen(): Promise<Anthropic | null> {
  const konfig = await integrationKonfigurationLesen('anthropic');
  if (konfig?.api_schluessel) {
    return new Anthropic({ apiKey: konfig.api_schluessel });
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return null;
}

/**
 * Analysiert ein Anruf-Transkript mit Claude und gibt Zusammenfassung + Verdict zurück.
 */
export async function transkriptAnalysieren(
  transkript: string,
  endedReason?: string,
  _benutzerdefinierterPrompt?: string
): Promise<GptAnalyseErgebnis> {
  // Schnelle Heuristiken bevor Claude aufgerufen wird
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

  const client = await claudeClientErstellen();
  if (!client) {
    // Auf error-Level, damit Sentry das als Alert erfasst — in Produktion ist die
    // Heuristik eine deutliche Qualitaetsminderung der Lead-Analyse.
    logger.error('Anthropic API-Key nicht konfiguriert – Lead-Analyse faellt auf Heuristik zurueck');
    return heuristikAnalyse(transkript, endedReason);
  }

  try {
    const antwort = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `${ANALYSE_PROMPT}\n\nTranskript:\n${transkript}`,
      }],
    });

    const textBlock = antwort.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      logger.warn('Claude gab keine Text-Antwort zurück');
      return heuristikAnalyse(transkript, endedReason);
    }

    const rohText = textBlock.text.trim();

    // JSON extrahieren
    let jsonText = rohText;
    const jsonStart = rohText.indexOf('{');
    const jsonEnd = rohText.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      jsonText = rohText.substring(jsonStart, jsonEnd + 1);
    }

    try {
      const claudeJson = JSON.parse(jsonText) as { summary?: string; verdict?: string };
      const verdict = claudeJson.verdict?.toLowerCase().trim() || '';
      const zusammenfassung = claudeJson.summary || '';

      const ergebnis = verdictMap[verdict];
      if (ergebnis) {
        logger.info(`Claude-Analyse: ${verdict} → ${ergebnis}`);
        return { zusammenfassung, verdict, ergebnis };
      }

      logger.warn(`Claude gab ungültiges Verdict: "${verdict}" – verwende Heuristik`);
      return heuristikAnalyse(transkript, endedReason);
    } catch {
      logger.warn('Claude-Antwort ist kein gültiges JSON – verwende Heuristik');
      return heuristikAnalyse(transkript, endedReason);
    }
  } catch (fehler) {
    logger.error('Claude-Analyse fehlgeschlagen:', { error: fehler });
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

  const client = await claudeClientErstellen();
  if (!client) {
    logger.warn('Anthropic API-Key nicht konfiguriert – Voicemail-Backup-Check übersprungen');
    return 'voicemail';
  }

  try {
    const antwort = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 50,
      messages: [{
        role: 'user',
        content: `${VOICEMAIL_BACKUP_PROMPT}\n\nTranskript:\n${transkript}`,
      }],
    });

    const textBlock = antwort.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') return 'voicemail';

    const rohText = textBlock.text.trim();
    let jsonText = rohText;
    const jsonStart = rohText.indexOf('{');
    const jsonEnd = rohText.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      jsonText = rohText.substring(jsonStart, jsonEnd + 1);
    }

    try {
      const claudeJson = JSON.parse(jsonText) as { verdict?: string };
      const verdict = claudeJson.verdict?.toLowerCase().trim();

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
 * Fallback-Heuristik wenn Claude nicht verfügbar ist.
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
    return { zusammenfassung: 'Person zeigt Interesse, Termin/Rückruf gewünscht.', verdict: 'callback scheduled', ergebnis: 'rueckruf_geplant' };
  }
  if (text.includes('kein interesse') || text.includes('nein danke') || text.includes('nicht interessiert')) {
    return { zusammenfassung: 'Kein Interesse geäußert.', verdict: 'not interested', ergebnis: 'nicht_interessiert' };
  }

  return { zusammenfassung: 'Kein eindeutiges Ergebnis ermittelbar.', verdict: 'hung up', ergebnis: 'nicht_abgenommen' };
}
