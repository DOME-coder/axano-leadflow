import Anthropic from '@anthropic-ai/sdk';
import { integrationKonfigurationLesen } from './integrationen.dienst';
import { aehnlicheVorlagenSuchen, promptVorlageErstellen } from './prompt-vorlagen.dienst';
import { logger } from '../hilfsfunktionen/logger';

export interface KiGenerierungEingabe {
  branche: string;
  produkt: string;
  zielgruppe: string;
  ton: string;
  kiName?: string;
  kiGeschlecht?: string;
  kiSprachstil?: string;
}

export interface KiGenerierungErgebnisMitQuelle extends KiGenerierungErgebnis {
  quelle: 'bibliothek' | 'generiert';
  vorlagenId?: string;
  vorlagenBranche?: string;
}

export interface KiGenerierungErgebnis {
  vapiPrompt: string;
  emailTemplates: {
    verpassterAnruf: { betreff: string; html: string };
    voicemailFollowup: { betreff: string; html: string };
    unerreichbar: { betreff: string; html: string };
  };
  whatsappTemplates: {
    anrufFehlgeschlagen: string;
    unerreichbar: string;
  };
  formularfelder: Array<{
    feldname: string;
    bezeichnung: string;
    feldtyp: string;
    pflichtfeld: boolean;
  }>;
}

async function claudeClientErstellen(): Promise<Anthropic> {
  // 1. Integration-Tabelle prüfen
  const konfig = await integrationKonfigurationLesen('anthropic');
  if (konfig?.api_schluessel) {
    return new Anthropic({ apiKey: konfig.api_schluessel });
  }

  // 2. Fallback: Umgebungsvariable
  if (process.env.ANTHROPIC_API_KEY) {
    return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  throw new Error('Anthropic API-Schlüssel ist nicht konfiguriert. Bitte unter Einstellungen → Integrationen eintragen oder ANTHROPIC_API_KEY als Umgebungsvariable setzen.');
}

/**
 * Generiert alle Kampagnen-Inhalte mit Claude AI.
 */
export async function kampagneInhalteGenerieren(eingabe: KiGenerierungEingabe): Promise<KiGenerierungErgebnis> {
  const client = await claudeClientErstellen();

  const prompt = `Erstelle alle Inhalte für eine Lead-Qualifizierungs-Kampagne.

Branche: ${eingabe.branche}
Produkt/Dienstleistung: ${eingabe.produkt}
Zielgruppe: ${eingabe.zielgruppe}
Ton: ${eingabe.ton}
Name des KI-Agenten: ${eingabe.kiName || 'wähle einen passenden Namen'}
Geschlecht des KI-Agenten: ${eingabe.kiGeschlecht || 'neutral'}
Sprachstil: ${eingabe.kiSprachstil || 'freundlich'}
Sprache: Deutsch

Gib NUR dieses JSON zurück:
{
  "vapiPrompt": "[Vollständiges Gesprächsskript für den KI-Agenten. Begrüßung, Qualifizierungsfragen, Einwandbehandlung, Terminvereinbarungs-Flow, Verabschiedung.]",
  "emailTemplates": {
    "verpassterAnruf": { "betreff": "[Betreff]", "html": "[HTML E-Mail-Inhalt mit {{vorname}} Variable]" },
    "voicemailFollowup": { "betreff": "[Betreff]", "html": "[HTML E-Mail-Inhalt mit {{vorname}} Variable]" },
    "unerreichbar": { "betreff": "[Betreff]", "html": "[HTML E-Mail-Inhalt mit {{vorname}} Variable]" }
  },
  "whatsappTemplates": {
    "anrufFehlgeschlagen": "[WhatsApp-Text mit {{vorname}} Variable]",
    "unerreichbar": "[WhatsApp-Text mit {{vorname}} Variable]"
  },
  "formularfelder": [
    { "feldname": "[snake_case]", "bezeichnung": "[Label auf Deutsch]", "feldtyp": "text|zahl|datum|auswahl|ja_nein", "pflichtfeld": true/false }
  ]
}

Wichtige Regeln:
- Der KI-Agent soll sich mit dem angegebenen Namen vorstellen und im angegebenen Sprachstil kommunizieren
- Der vapiPrompt muss ein vollständiges, natürlich klingendes Gesprächsskript sein (mindestens 500 Zeichen)
- E-Mail-Templates müssen professionelles HTML mit Inline-Styles sein
- Die Variable {{vorname}} muss in allen Templates vorkommen
- Formularfelder müssen branchenspezifisch und relevant sein
- Alle Texte müssen im angegebenen Ton verfasst sein
- Gib NUR valides JSON zurück, keine Erklärung`;

  try {
    const antwort = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt,
      }],
    });

    const textBlock = antwort.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude hat keine Text-Antwort zurückgegeben');
    }

    const rohText = textBlock.text.trim();

    // JSON extrahieren (falls Claude Text drumherum schreibt)
    let jsonText = rohText;
    const jsonStart = rohText.indexOf('{');
    const jsonEnd = rohText.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      jsonText = rohText.substring(jsonStart, jsonEnd + 1);
    }

    try {
      const ergebnis = JSON.parse(jsonText) as KiGenerierungErgebnis;

      // Validierung der Pflichtfelder
      if (!ergebnis.vapiPrompt || !ergebnis.emailTemplates || !ergebnis.whatsappTemplates || !ergebnis.formularfelder) {
        throw new Error('Unvollständige Antwort von Claude');
      }

      logger.info('KI-Generierung erfolgreich', {
        vapiPromptLaenge: ergebnis.vapiPrompt.length,
        formularfelderAnzahl: ergebnis.formularfelder.length,
      });

      return ergebnis;
    } catch (parseError) {
      logger.error('Claude JSON-Parsing fehlgeschlagen:', { rohText: rohText.substring(0, 200), error: parseError });
      throw new Error('Die KI-Antwort konnte nicht verarbeitet werden. Bitte erneut versuchen.');
    }
  } catch (fehler) {
    if (fehler instanceof Anthropic.APIError) {
      logger.error('Claude API-Fehler:', { status: fehler.status, message: fehler.message });
      throw new Error(`Claude API-Fehler: ${fehler.message}`);
    }
    throw fehler;
  }
}

/**
 * Prüft zuerst die Bibliothek, generiert nur bei Bedarf mit Claude.
 * Speichert neu generierte Prompts automatisch in der Bibliothek.
 */
export async function kampagneInhalteMitBibliothek(
  eingabe: KiGenerierungEingabe
): Promise<KiGenerierungErgebnisMitQuelle> {
  // 1. Ähnliche Vorlagen in der Bibliothek suchen
  const vorlagen = await aehnlicheVorlagenSuchen(eingabe.branche);

  if (vorlagen.length > 0) {
    const vorlage = vorlagen[0];
    logger.info(`Prompt-Bibliothek: Treffer für "${eingabe.branche}" → Vorlage "${vorlage.name}"`);

    // Bibliothek liefert nur den vapiPrompt — E-Mail/WhatsApp/Felder werden trotzdem generiert
    // damit sie zum spezifischen Kunden passen
    return {
      quelle: 'bibliothek',
      vorlagenId: vorlage.id,
      vorlagenBranche: vorlage.branche,
      vapiPrompt: vorlage.vapiPrompt,
      emailTemplates: {
        verpassterAnruf: { betreff: '', html: '' },
        voicemailFollowup: { betreff: '', html: '' },
        unerreichbar: { betreff: '', html: '' },
      },
      whatsappTemplates: {
        anrufFehlgeschlagen: '',
        unerreichbar: '',
      },
      formularfelder: [],
    };
  }

  // 2. Kein Treffer → KI generieren
  logger.info(`Prompt-Bibliothek: Kein Treffer für "${eingabe.branche}" → KI-Generierung`);
  const ergebnis = await kampagneInhalteGenerieren(eingabe);

  // 3. Generierten Prompt automatisch in Bibliothek speichern
  try {
    await promptVorlageErstellen({
      name: `${eingabe.branche} – ${eingabe.produkt || 'Standard'}`,
      branche: eingabe.branche,
      produkt: eingabe.produkt || undefined,
      vapiPrompt: ergebnis.vapiPrompt,
    });
    logger.info(`Prompt-Bibliothek: Neue Vorlage gespeichert für "${eingabe.branche}"`);
  } catch (fehler) {
    logger.warn('Prompt-Vorlage konnte nicht gespeichert werden:', { error: fehler });
  }

  return { ...ergebnis, quelle: 'generiert' };
}
