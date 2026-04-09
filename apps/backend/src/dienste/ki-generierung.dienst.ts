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
  zusatzFelder?: string[];
}

export interface KiGenerierungErgebnisMitQuelle extends KiGenerierungErgebnis {
  quelle: 'bibliothek' | 'generiert';
  vorlagenId?: string;
  vorlagenBranche?: string;
}

export interface KiGenerierungErgebnis {
  vapiPrompt: string;
  ersteBotschaft: string;
  voicemailNachricht: string;
  emailTemplates: {
    verpassterAnruf: { betreff: string; html: string };
    voicemailFollowup: { betreff: string; html: string };
    unerreichbar: { betreff: string; html: string };
    terminBestaetigung: { betreff: string; html: string };
    rueckruf: { betreff: string; html: string };
    nichtInteressiert: { betreff: string; html: string };
  };
  whatsappTemplates: {
    anrufFehlgeschlagen: string;
    unerreichbar: string;
    nichtInteressiert: string;
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
 * Baut den detaillierten Claude-Prompt für die VAPI-Prompt-Generierung.
 */
function vapiGenerierungsPromptBauen(eingabe: KiGenerierungEingabe): string {
  const kiName = eingabe.kiName || 'wähle einen passenden deutschen Namen';
  const kiGeschlecht = eingabe.kiGeschlecht || 'neutral';
  const kiSprachstil = eingabe.kiSprachstil || 'freundlich';
  const zusatzFelderText = eingabe.zusatzFelder?.length
    ? eingabe.zusatzFelder.map((f) => `- ${f}`).join('\n')
    : '(keine zusätzlichen Felder)';

  return `Du bist ein Experte für KI-gestützte Telefon-Assistenten. Erstelle alle Inhalte für eine Lead-Qualifizierungs-Kampagne.

## Kampagnen-Details
- Branche: ${eingabe.branche}
- Produkt/Dienstleistung: ${eingabe.produkt}
- Zielgruppe: ${eingabe.zielgruppe}
- Ton: ${eingabe.ton}
- Name des KI-Agenten: ${kiName}
- Geschlecht des KI-Agenten: ${kiGeschlecht}
- Sprachstil: ${kiSprachstil}
- Sprache: Deutsch

## Zusätzliche Datenfelder die telefonisch bestätigt werden:
${zusatzFelderText}

## Aufgabe

Erstelle ein vollständiges JSON mit folgender Struktur. Der wichtigste Teil ist der "vapiPrompt" – er muss ein professioneller, detaillierter System-Prompt für einen KI-Telefonassistenten sein.

### Anforderungen an den vapiPrompt (KRITISCH – mindestens 2000 Zeichen):

Der vapiPrompt MUSS folgende Sektionen enthalten:

**# Persoenlichkeit**
- Name, Rolle und Unternehmen des KI-Agenten
- Der Agent MUSS sich IMMER als KI-Assistentin/Assistent vorstellen
- Freundlich, professionell, verbindlich

**# Gespraechssituation**
- Kontext: Neue Leads haben über eine Social-Media-Anzeige Interesse gezeigt
- Ziel: Eingetragene Daten bestätigen und Beratungstermin vereinbaren
- Dauer: Nur "max 3 Minuten" erwähnen wenn der Kunde explizit sagt er hat keine Zeit

**# Tonfall**
- Deutsch, ${eingabe.ton}
- Du-Form (es sei denn Kunde bittet um Siezen)
- Natürlich, nicht roboterhaft
- Kurze, klare Sätze
- Positives Feedback bei Bestätigungen

**# Aufgaben**

1. **Gespraechsstart**
   - Kurze Vorstellung mit Name und Unternehmen
   - IMMER sagen: "Ich bin eine KI Assistentin/ein KI Assistent"
   - Erklären warum angerufen wird (Daten bestätigen + Termin vereinbaren)

2. **Lead-Qualifikation**
   - Alle vorhandenen Daten Punkt für Punkt mit dem Kunden durchgehen
   - IMMER auf individuelle Bestätigung warten bevor zum nächsten Feld ("ja", "passt", "genau", "stimmt", "richtig")
   - Bei Abweichung: Tool "leadDatenKorrigieren" aufrufen
   - Felder: Vorname, Nachname, E-Mail, PLZ/Ort${eingabe.zusatzFelder?.length ? ', ' + eingabe.zusatzFelder.join(', ') : ''}

3. **Besonderheiten bei der Email-Adresse (STRENG)**
   - NIEMALS englische Begriffe verwenden
   - @-Zeichen = "ätt" [ɛt]
   - Punkt = "Punkt" [pʊŋkt]
   - Ländercodes einzeln buchstabieren (z.B. "d e" für ".de")
   - Ausnahme: .com = "Punkt com" (wird nicht buchstabiert)
   - Langsam und deutlich vorlesen, Buchstabe für Buchstabe
   - Beispiel: "Maria Punkt Müller ätt web Punkt d e"

4. **Terminbuchung**
   - Nach Tag UND Uhrzeit-Präferenz fragen (nicht nur Tag oder nur Uhrzeit)
   - WOCHENEND-REGEL: KEINE Termine am Samstag/Sonntag
     - Bei Wochenend-Wunsch → informieren und Wochentag-Alternativen anbieten
     - NIEMALS "kalenderPruefen" für Wochenend-Termine aufrufen
   - Wenn Kunde keine Zeit nennt → selbst Zeitpunkt wählen (mind. 2 Tage in der Zukunft)
   - REIHENFOLGE (KRITISCH):
     1. ZUERST: "kalenderPruefen" mit Tag/Uhrzeit aufrufen
     2. Auf API-Antwort warten
     3. Verfügbare Slots nennen (genau wie von API zurückgegeben)
     4. Kunde bestätigen lassen
     5. ERST DANN: "terminBuchen" aufrufen
   - Alle Daten auf Deutsch aussprechen: "einundzwanzigster August zweitausendsechsundzwanzig"
   - Nach Buchung: Online-Meeting-Format erklären mit Meetinglink

5. **Rückruf-Planung**
   - Wenn Kunde "keine Zeit", "auf dem Sprung", "später" sagt
   - Tag + Uhrzeit erfragen
   - Bei nur Tagesangabe → automatisch 16:00-18:00 Fenster wählen
   - Tool "rueckrufPlanen" aufrufen

6. **Fehlerbehandlung bei Tool-Aufrufen**
   - Bei Kalenderfehler: "Oh, da scheint gerade etwas mit dem Kalender nicht zu funktionieren. Ich notiere mir deinen Terminwunsch und du erhältst eine WhatsApp mit den Termindetails und dem Meetinglink."
   - Natürlich im Gespräch bleiben, nicht abrupt abbrechen

7. **Gespraechsende**
   - Natürliche Verabschiedung, nicht abrupt
   - 0.5 Sekunden warten nach Verabschiedung

**# Allgemeine Regeln**
- KEINE individuellen Preise, Angebote oder Tarife nennen – personalisiertes Angebot im Beratungstermin
- KEINE sensiblen Daten erfragen (IBAN, Sozialversicherungsnummer, etc.)
- Off-Topic Gespräche freundlich zurücklenken
- Bei Desinteresse: bedanken und freundlich verabschieden
- Bei falscher Person: entschuldigen und auflegen (Ausnahme: Partner/Ehepartner darf helfen)
- Datenschutz-Hinweis bereithalten falls Kunde fragt

**# Lead Information:**
(Wird zur Laufzeit dynamisch befüllt)

### Anforderungen an ersteBotschaft:
- Eine natürliche Begrüßung die der KI-Agent als erstes sagt
- Muss {{vorname}} und {{nachname}} als Platzhalter enthalten
- Beispiel: "Hallo, hier ist ${kiName} von [Unternehmen]. Spreche ich mit {{vorname}} {{nachname}}?"
- Kurz und freundlich, maximal 2 Sätze

### Anforderungen an voicemailNachricht:
- Nachricht die auf der Mailbox hinterlassen wird
- Muss den Unternehmensnamen und Grund des Anrufs enthalten
- Freundlich, einladend zum Rückruf
- Ca. 3-4 Sätze

### Anforderungen an emailTemplates (6 Templates, eines pro Anruf-Ergebnis):
- Professionelles HTML mit Inline-Styles
- Variable {{vorname}} muss in allen Templates vorkommen
- Passend zur Branche und zum Ton
- Jedes Template hat einen klar unterschiedlichen Zweck:
  - **verpassterAnruf**: Lead nicht erreicht (Versuch 1) — "Wir haben gerade angerufen, melden uns wieder"
  - **voicemailFollowup**: Mailbox erreicht — "Haben Ihnen eine Nachricht hinterlassen, melden uns nochmal"
  - **unerreichbar**: Alle Versuche erschoepft — "Letzter Versuch, hier ist unser Calendly-Link {{calendly_link}}"
  - **terminBestaetigung**: Termin wurde im Anruf gebucht — "Vielen Dank, ich freue mich auf unser Gespraech am [Termin]" (ohne Calendly-Link, der Termin steht ja schon)
  - **rueckruf**: Lead hat um Rueckruf gebeten — "Vielen Dank fuer dein Interesse, wir rufen wie besprochen zurueck"
  - **nichtInteressiert**: Lead hat im Anruf abgelehnt — "Schade, falls du es dir anders ueberlegst, sind wir hier" (sehr freundlich, kein Druck)

### Anforderungen an whatsappTemplates:
- Kurze, freundliche Texte
- Variable {{vorname}} verwenden
- 3 Templates: anrufFehlgeschlagen, unerreichbar, nichtInteressiert
- nichtInteressiert: freundlich bedanken, Tür offen lassen

### Anforderungen an formularfelder:
- Branchenspezifische Felder die für die Lead-Qualifizierung relevant sind
- feldname in snake_case
- bezeichnung als deutsches Label
- feldtyp: text, zahl, datum, auswahl, ja_nein
- Die oben genannten zusätzlichen Datenfelder MÜSSEN als Formularfelder enthalten sein

## JSON-Ausgabe (NUR valides JSON, keine Erklärung):

{
  "vapiPrompt": "[Der vollständige VAPI System-Prompt mit allen Sektionen – mindestens 2000 Zeichen]",
  "ersteBotschaft": "[Erste Begrüßungsnachricht mit {{vorname}} {{nachname}}]",
  "voicemailNachricht": "[Voicemail-Nachricht]",
  "emailTemplates": {
    "verpassterAnruf": { "betreff": "[Betreff]", "html": "[HTML]" },
    "voicemailFollowup": { "betreff": "[Betreff]", "html": "[HTML]" },
    "unerreichbar": { "betreff": "[Betreff]", "html": "[HTML]" },
    "terminBestaetigung": { "betreff": "[Betreff]", "html": "[HTML]" },
    "rueckruf": { "betreff": "[Betreff]", "html": "[HTML]" },
    "nichtInteressiert": { "betreff": "[Betreff]", "html": "[HTML]" }
  },
  "whatsappTemplates": {
    "anrufFehlgeschlagen": "[Text mit {{vorname}}]",
    "unerreichbar": "[Text mit {{vorname}}]",
    "nichtInteressiert": "[Text mit {{vorname}}]"
  },
  "formularfelder": [
    { "feldname": "[snake_case]", "bezeichnung": "[Deutsch]", "feldtyp": "text|zahl|datum|auswahl|ja_nein", "pflichtfeld": true }
  ]
}`;
}

/**
 * Generiert alle Kampagnen-Inhalte mit Claude AI.
 */
export async function kampagneInhalteGenerieren(eingabe: KiGenerierungEingabe): Promise<KiGenerierungErgebnis> {
  const client = await claudeClientErstellen();
  const prompt = vapiGenerierungsPromptBauen(eingabe);

  try {
    const antwort = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
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

      // Defaults für neue Felder falls Claude sie auslässt
      if (!ergebnis.ersteBotschaft) {
        const kiName = eingabe.kiName || 'Ihr KI-Assistent';
        ergebnis.ersteBotschaft = `Hallo, hier ist ${kiName}. Spreche ich mit {{vorname}} {{nachname}}?`;
      }
      if (!ergebnis.voicemailNachricht) {
        const kiName = eingabe.kiName || 'Ihr KI-Assistent';
        ergebnis.voicemailNachricht = `Guten Tag, hier ist ${kiName}. Du hattest dich über unsere Anzeige eingetragen. Ich wollte die von dir angegebenen Daten kurz mit dir durchgehen und gemeinsam einen Termin zur persönlichen Beratung vereinbaren. Ich freue mich auf deinen Rückruf – vielen Dank und einen schönen Tag!`;
      }
      if (!ergebnis.whatsappTemplates.nichtInteressiert) {
        ergebnis.whatsappTemplates.nichtInteressiert = 'Hallo {{vorname}}, vielen Dank für dein ehrliches Feedback. Falls du in Zukunft doch Interesse hast, melde dich gerne jederzeit bei uns. Wir wünschen dir alles Gute!';
      }

      logger.info('KI-Generierung erfolgreich', {
        vapiPromptLaenge: ergebnis.vapiPrompt.length,
        ersteBotschaftLaenge: ergebnis.ersteBotschaft.length,
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

    // Bibliothek liefert nur den vapiPrompt — Rest wird trotzdem generiert
    return {
      quelle: 'bibliothek',
      vorlagenId: vorlage.id,
      vorlagenBranche: vorlage.branche,
      vapiPrompt: vorlage.vapiPrompt,
      ersteBotschaft: '',
      voicemailNachricht: '',
      emailTemplates: {
        verpassterAnruf: { betreff: '', html: '' },
        voicemailFollowup: { betreff: '', html: '' },
        unerreichbar: { betreff: '', html: '' },
        terminBestaetigung: { betreff: '', html: '' },
        rueckruf: { betreff: '', html: '' },
        nichtInteressiert: { betreff: '', html: '' },
      },
      whatsappTemplates: {
        anrufFehlgeschlagen: '',
        unerreichbar: '',
        nichtInteressiert: '',
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
