import { prisma } from '../datenbank/prisma.client';
import { vapiAnrufStarten } from './vapi.dienst';
import { transkriptAnalysieren, voicemailBackupCheck } from './gpt.dienst';
import { emailMitTemplateSenden, emailSenden } from './email.dienst';
import { superchatKontaktFinden, superchatKontaktErstellen, superchatTemplateNachrichtSenden, hatLeadPerWhatsAppGeantwortet } from './whatsapp.dienst';
import { integrationKonfigurationLesenMitFallback } from './integrationen.dienst';
import { socketServer } from '../websocket/socket.handler';
import { logger } from '../hilfsfunktionen/logger';
import { anrufQueue, followUpQueue } from '../jobs/queue';
import { anrufPollingStarten } from '../jobs/anruf-polling.job';
import { zeitfensterAktiv, naechsterZeitfensterbeginn } from '../hilfsfunktionen/zeitfenster';
import { istHandynummer } from '../hilfsfunktionen/telefon.formatierung';
import { emailZumVorlesen } from '../hilfsfunktionen/email.aussprache';

interface AnrufZeitslot {
  stunde: number;
  minute: number;
}

type FollowUpGrund =
  | 'verpasst'
  | 'voicemail'
  | 'unerreichbar'
  | 'nichtInteressiert'
  | 'terminBestaetigung'
  | 'rueckruf';

/**
 * Startet die Anruf-Sequenz für einen Lead.
 */
export async function anrufSequenzStarten(leadId: string, kampagneId: string) {
  const kampagne = await prisma.kampagne.findUnique({ where: { id: kampagneId } });
  if (!kampagne) return;

  if (!kampagne.vapiAktiviert) return;

  // Assistant-ID kann entweder in der Kampagne oder in der Kunden-VAPI-Integration stehen
  if (!kampagne.vapiAssistantId) {
    const vapiKonfig = await integrationKonfigurationLesenMitFallback('vapi', kampagne.kundeId);
    if (!vapiKonfig?.assistant_id) {
      logger.warn(`Anruf-Sequenz übersprungen: Keine VAPI-Assistant-ID für Lead ${leadId}`);
      return;
    }
  }

  logger.info(`Anruf-Sequenz gestartet für Lead ${leadId}`);
  await naechstenAnrufPlanen(leadId, kampagneId, 1);
}

/**
 * Plant den nächsten Anrufversuch mit intelligenter Zeitberechnung.
 */
export async function naechstenAnrufPlanen(
  leadId: string,
  kampagneId: string,
  versuchNummer: number
) {
  const kampagne = await prisma.kampagne.findUnique({ where: { id: kampagneId } });
  if (!kampagne) return;

  if (versuchNummer > kampagne.maxAnrufVersuche) {
    // Alle Versuche erschöpft
    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { status: 'Nicht erreichbar' },
    });
    await aktivitaetLoggen(leadId, 'anruf_fehlgeschlagen',
      `Alle ${kampagne.maxAnrufVersuche} Anrufversuche erschöpft – Lead nicht erreichbar`);

    // Follow-up "Nicht erreichbar" senden
    await followUpSenden(leadId, kampagneId, kampagne, 'unerreichbar');

    // Team-Benachrichtigung senden
    if (kampagne.benachrichtigungEmail) {
      await teamBenachrichtigungSenden(
        kampagne.benachrichtigungEmail,
        lead,
        'Nicht erreichbar',
        `Alle ${kampagne.maxAnrufVersuche} Anrufversuche erschöpft.`,
        kampagne.kundeId
      );
    }
    return;
  }

  const zeitslots = kampagne.anrufZeitslots as unknown as AnrufZeitslot[];
  const geplantFuer = naechsteAnrufzeitBerechnen(zeitslots);

  const versuch = await prisma.anrufVersuch.create({
    data: {
      leadId,
      kampagneId,
      versuchNummer,
      status: 'geplant',
      geplantFuer,
    },
  });

  // Lead-Feld aktualisieren
  await prisma.lead.update({
    where: { id: leadId },
    data: { naechsterAnrufAm: geplantFuer },
  });

  // BullMQ-Job mit Delay einplanen
  const delay = Math.max(geplantFuer.getTime() - Date.now(), 1000);
  await anrufQueue.add('anruf-durchfuehren', {
    anrufVersuchId: versuch.id,
    leadId,
    kampagneId,
  }, {
    delay,
    jobId: `anruf-${versuch.id}`,
  });

  logger.info(`Anruf #${versuchNummer} geplant für ${geplantFuer.toISOString()} (Lead ${leadId})`);

  // Echtzeit-Event
  const io = socketServer();
  if (io) {
    io.to(`kampagne:${kampagneId}`).emit('anruf:geplant', {
      leadId,
      versuchNummer,
      geplantFuer: geplantFuer.toISOString(),
    });
  }
}

/**
 * Plant einen sofortigen Anruf (5 Sek Delay) — fuer manuelle Tests oder
 * fehlerhaftes Auflegen. Umgeht das Zeitslot-Routing und ruft den
 * Lead unmittelbar an.
 */
export async function sofortigenAnrufPlanen(leadId: string, kampagneId: string, versuchNummer: number) {
  const versuch = await prisma.anrufVersuch.create({
    data: { leadId, kampagneId, versuchNummer, status: 'geplant', geplantFuer: new Date() },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { naechsterAnrufAm: new Date() },
  });

  await anrufQueue.add('anruf-durchfuehren', {
    anrufVersuchId: versuch.id, leadId, kampagneId,
  }, { delay: 5000, jobId: `anruf-sofort-${versuch.id}` });

  logger.info(`Sofortiger Anruf geplant (5s) für Lead ${leadId} – Versuch #${versuchNummer}`);

  const io = socketServer();
  if (io) {
    io.to(`kampagne:${kampagneId}`).emit('anruf:geplant', {
      leadId,
      versuchNummer,
      geplantFuer: new Date().toISOString(),
    });
  }

  return versuch;
}

/**
 * Führt einen geplanten Anruf durch.
 */
export async function anrufDurchfuehren(anrufVersuchId: string) {
  const versuch = await prisma.anrufVersuch.findUnique({
    where: { id: anrufVersuchId },
    include: { lead: true },
  });

  if (!versuch) {
    logger.warn(`AnrufVersuch ${anrufVersuchId} nicht gefunden`);
    return;
  }

  const lead = versuch.lead;

  // Prüfe ob Lead bereits erreicht wurde
  const beendendeStatus = ['Termin gebucht', 'Nicht interessiert', 'Falsche Nummer', 'Nicht erreichbar', 'WhatsApp erhalten'];
  if (beendendeStatus.includes(lead.status)) {
    logger.info(`Lead ${lead.id} hat bereits Status "${lead.status}" – Anruf übersprungen`);
    await prisma.anrufVersuch.update({
      where: { id: anrufVersuchId },
      data: { status: 'abgeschlossen', fehlerNachricht: `Übersprungen: Lead-Status "${lead.status}"` },
    });
    return;
  }

  // Prüfe ob Lead zwischenzeitlich per WhatsApp geantwortet hat (anbieterabhaengig)
  if (lead.telefon && versuch.versuchNummer >= 1) {
    try {
      const kampagneFuerCheck = await prisma.kampagne.findUnique({
        where: { id: versuch.kampagneId },
        select: { whatsappAnbieter: true, kundeId: true },
      });

      let hatGeantwortet = false;
      if (kampagneFuerCheck?.whatsappAnbieter === 'meta') {
        const { hatLeadPerWhatsAppMetaGeantwortet } = await import('./whatsapp-meta.dienst');
        hatGeantwortet = await hatLeadPerWhatsAppMetaGeantwortet(lead.id);
      } else {
        hatGeantwortet = await hatLeadPerWhatsAppGeantwortet(lead.telefon, kampagneFuerCheck?.kundeId);
      }

      if (hatGeantwortet) {
        logger.info(`Lead ${lead.id} hat per WhatsApp geantwortet – Anruf übersprungen`);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { status: 'WhatsApp erhalten' },
        });
        await prisma.anrufVersuch.update({
          where: { id: anrufVersuchId },
          data: { status: 'abgeschlossen', fehlerNachricht: 'Übersprungen: Lead hat per WhatsApp geantwortet' },
        });
        return;
      }
    } catch {
      // Check fehlgeschlagen → weiter mit Anruf
    }
  }

  const kampagne = await prisma.kampagne.findUnique({
    where: { id: versuch.kampagneId },
    include: {
      kunde: { select: { name: true } },
      felder: { orderBy: { reihenfolge: 'asc' } },
    },
  });
  if (!kampagne) return;

  // Status + Lead-Felder aktualisieren
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: 'Anruf läuft',
      anrufVersucheAnzahl: { increment: 1 },
      letzterAnrufAm: new Date(),
    },
  });

  await prisma.anrufVersuch.update({
    where: { id: anrufVersuchId },
    data: { status: 'laeuft', gestartetAm: new Date() },
  });

  await aktivitaetLoggen(lead.id, 'anruf_gestartet',
    `Anrufversuch #${versuch.versuchNummer} gestartet`);

  try {
    // Bisherige Gesprächszusammenfassungen laden (ab Versuch #2)
    let assistantOverrides: Record<string, unknown> | undefined;
    if (versuch.versuchNummer > 1) {
      const bisherigeVersuche = await prisma.anrufVersuch.findMany({
        where: { leadId: lead.id, status: 'abgeschlossen', gptAnalyse: { not: null } },
        orderBy: { versuchNummer: 'asc' },
        select: { versuchNummer: true, gptAnalyse: true },
      });

      if (bisherigeVersuche.length > 0) {
        const gespraechsHistorie = bisherigeVersuche
          .map((v) => {
            try {
              const json = JSON.parse(v.gptAnalyse!) as { summary?: string };
              return `Versuch #${v.versuchNummer}: ${json.summary || v.gptAnalyse}`;
            } catch {
              return `Versuch #${v.versuchNummer}: ${v.gptAnalyse}`;
            }
          })
          .join('\n');

        assistantOverrides = {
          model: {
            messages: [{
              role: 'system',
              content: `\n\n# Zusammenfassung der bisherigen Gespräche:\n${gespraechsHistorie}`,
            }],
          },
        };
      }
    }

    // Lead-Daten fuer den Prompt zusammenstellen
    const leadFelddaten = await prisma.leadFelddatum.findMany({
      where: { leadId: lead.id },
      include: { feld: { select: { bezeichnung: true } } },
    });

    // Name als kombinierte Einheit (vermeidet getrennte Abfrage von Vor-/Nachname).
    // Telefon bewusst NICHT im Block — der Lead nimmt den Anruf entgegen, die
    // Nummer ist damit implizit bestaetigt. Die KI braucht sie nicht erneut.
    const nameKombiniert = [lead.vorname, lead.nachname].filter(Boolean).join(' ') || '—';

    // Kampagnen-Felder herausfiltern, die denselben Inhalt wie die Standardfelder
    // haben (z.B. Kampagne hat ein Feld "Vorname" zusaetzlich) — sonst steht der
    // Name doppelt im Prompt.
    const STANDARD_BEZEICHNUNGEN = new Set([
      'vorname', 'nachname', 'name', 'vollstaendigername', 'vollstaendiger name',
      'email', 'emailadresse', 'e-mail', 'e-mail-adresse', 'e-mail adresse',
      'telefon', 'telefonnummer', 'handynummer', 'mobil', 'mobilnummer',
    ]);
    const istStandardBezeichnung = (s: string) =>
      STANDARD_BEZEICHNUNGEN.has(s.toLowerCase().replace(/\s+/g, ' ').trim());

    const gefilterteFelddaten = leadFelddaten.filter((f) => !istStandardBezeichnung(f.feld.bezeichnung));

    // Nummerierte Liste — der LLM sieht klar, wie viele Punkte zu bestaetigen sind
    // und in welcher Reihenfolge er sie abarbeiten muss.
    const leadDatenZeilen = [
      `Name: ${nameKombiniert}`,
      `E-Mail: ${lead.email || '—'}`,
      ...gefilterteFelddaten.map((f) => `${f.feld.bezeichnung}: ${f.wert || '—'}`),
    ];
    const leadDatenBlock = leadDatenZeilen
      .map((zeile, i) => `${i + 1}. ${zeile}`)
      .join('\n');
    const anzahlBestaetigungen = leadDatenZeilen.length;

    // Automatisch ermitteln welche Infos der Lead noch NICHT angegeben hat.
    // Diese werden als "zu erfassen" in einem eigenen Block gelistet,
    // damit die KI weiss, wonach sie im Gespraech fragen muss.
    const felddatenMap = new Map(leadFelddaten.map((f) => [f.feldId, f.wert]));
    const nameFehlt = !lead.vorname && !lead.nachname;
    const nurVornameFehlt = !lead.vorname && !!lead.nachname;
    const nurNachnameFehlt = !!lead.vorname && !lead.nachname;
    const emailFehlt = !lead.email;

    const zuErfassenZeilen: string[] = [];
    if (nameFehlt) {
      zuErfassenZeilen.push('- **Vollstaendiger Name** — frag genau so: "Wie lautet Ihr vollstaendiger Name?" (NIEMALS getrennt nach Vor- und Nachname fragen).');
    } else if (nurVornameFehlt) {
      zuErfassenZeilen.push('- **Vorname** — frag natuerlich danach.');
    } else if (nurNachnameFehlt) {
      zuErfassenZeilen.push('- **Nachname** — frag natuerlich danach.');
    }
    if (emailFehlt) {
      zuErfassenZeilen.push('- **E-Mail-Adresse** — frag danach und wiederhole sie zur Bestaetigung.');
    }
    // Kampagnen-Felder die leer sind
    const kampagnenFelder = ((kampagne as { felder?: Array<{ id: string; bezeichnung: string; feldtyp: string; pflichtfeld: boolean }> }).felder) || [];
    for (const feld of kampagnenFelder) {
      // Duplikate der Standardfelder ueberspringen — diese werden bereits
      // ueber lead.vorname / lead.nachname / lead.email abgebildet.
      if (istStandardBezeichnung(feld.bezeichnung)) continue;
      const wert = felddatenMap.get(feld.id);
      if (wert && wert.trim().length > 0) continue; // bereits vorhanden
      let hinweis = '';
      if (feld.feldtyp === 'ja_nein') hinweis = ' (Ja/Nein-Antwort)';
      else if (feld.feldtyp === 'datum') hinweis = ' (Datum — lass dir Tag, Monat, Jahr nennen)';
      else if (feld.feldtyp === 'zahl') hinweis = ' (Zahl)';
      else if (feld.feldtyp === 'auswahl') hinweis = ' (eine passende Option auswaehlen)';
      const pflichtIcon = feld.pflichtfeld ? ' [Pflicht]' : '';
      // Sonderformulierung fuer Wohnort/Stadt-Felder
      const bezeichnungLower = feld.bezeichnung.toLowerCase();
      if (bezeichnungLower === 'ort' || bezeichnungLower === 'wohnort' || bezeichnungLower === 'stadt') {
        zuErfassenZeilen.push(`- **${feld.bezeichnung}**${pflichtIcon} — frag: "Wo wohnen Sie?" (NICHT "Ihr Wohnort ist…?").`);
      } else {
        zuErfassenZeilen.push(`- **${feld.bezeichnung}**${pflichtIcon}${hinweis}`);
      }
    }

    const erfassungsBlock = zuErfassenZeilen.length > 0
      ? `\n\n# ZU ERFASSENDE ANGABEN (in natuerlicher Reihenfolge im Gespraech)

Frag im Laufe des Gespraechs nach den folgenden Informationen. Stelle die Fragen natuerlich und nicht wie ein Formular. Wiederhole bei der E-Mail zur Bestaetigung. Notiere dir die Antworten fuer den spaeteren Termin.

${zuErfassenZeilen.join('\n')}`
      : '';

    // Agent-Name + Firmenname konsistent erzwingen
    const kundenFirmenname = (kampagne as { kunde?: { name: string } | null }).kunde?.name;
    let nameBlock = '';
    if (kampagne.kiName) {
      nameBlock += `\n\n# DEIN NAME\nDein Name ist ${kampagne.kiName}. Verwende AUSSCHLIESSLICH diesen Namen im gesamten Gespraech. Stelle dich IMMER als "${kampagne.kiName}" vor, niemals mit einem anderen Namen.`;
    }
    if (kundenFirmenname) {
      nameBlock += `\n\n# UNTERNEHMEN\nDu arbeitest fuer "${kundenFirmenname}". Sage im Gespraech IMMER den echten Firmennamen "${kundenFirmenname}" — NIEMALS einen erfundenen oder anderen Firmennamen. Beispiel: "Ich rufe im Namen von ${kundenFirmenname} an."`;
    }

    // Alles in EINEN kombinierten Prompt (keine separaten System-Messages)
    // So beachtet das LLM Lead-Daten, Sprach-Regeln und Name-Anweisung zuverlaessig.
    // Der Bestaetigungs-Block steht BEWUSST ganz vorne, damit er bei Konflikten
    // mit kampagne.vapiPrompt Vorrang hat.
    const kombinierterPrompt = `# UMGANG MIT LEAD-DATEN (HOECHSTE PRIORITAET — IMMER BEACHTEN)

Der LEAD-DATEN-Block weiter unten enthaelt eine NUMMERIERTE Liste mit
${anzahlBestaetigungen} Punkten. Alle Angaben mit Wert (nicht "—") hat der Lead
bereits selbst bei der Anmeldung eingetragen.

## PFLICHT-ABLAUF (keine Ausnahmen)

Du MUSST im Gespraech **JEDEN einzelnen Punkt** der Liste vom Lead bestaetigen
lassen. **KEINEN** Punkt darfst du auslassen.

- Gehe die Punkte der Reihe nach durch (von oben nach unten).
- **Nie** einzelne Punkte weglassen, auch wenn sie unwichtig erscheinen — der
  Admin hat bewusst entschieden, dass sie bestaetigt werden sollen.
- Bei Punkten mit Wert: bestaetigen (siehe FORMULIERUNGS-VIELFALT unten).
- Bei Punkten mit "—" (leer): einmal nachfragen.
- **Erst wenn alle ${anzahlBestaetigungen} Punkte vom Lead bestaetigt (oder
  korrigiert) wurden**, darfst du zum naechsten Gespraechs-Ziel uebergehen (z.B.
  Terminvereinbarung). Vorher NICHT.
- Wenn der Lead eine Angabe korrigieren moechte, nutze das Tool "leadDatenKorrigieren".

## NATUERLICHER TON — ABSOLUT WICHTIG

Die Nummerierung (1., 2., 3., ...) im LEAD-DATEN-Block dient AUSSCHLIESSLICH
deiner internen Orientierung, damit du keinen Punkt vergisst. Die Woerter
**"Punkt 1"**, **"Punkt 2"**, **"erstens"**, **"zweitens"**, **"naechster Punkt"**
und aehnliche Zaehl-Formulierungen duerfen im Gespraech mit dem Lead **NIEMALS**
vorkommen. Formuliere jede Frage als ganz natuerlichen, gesprochenen deutschen
Satz — wie ein freundlicher Mensch am Telefon, der die Angaben ohne sichtbare
Liste im Kopf hat.

## FORMULIERUNGS-VIELFALT (IMMER VARIIEREN)

Verwende NIEMALS zweimal hintereinander dieselbe Bestaetigungs-Formulierung.
Wechsle Satzstruktur, Rhythmus und Einleitung, damit du wie ein echter Mensch
klingst und nicht wie ein Formular-Abarbeiter. Beispiele fuer Varianten (du
sollst auch eigene bilden):

- "Ich sehe hier, Sie haben [X] als [Y] angegeben — stimmt das so?"
- "Bei [X] steht [Y] — ist das korrekt?"
- "Sie haben angegeben: [Y]. Passt das?"
- "[Y] — das ist Ihr [X], richtig?"
- "Ich habe hier Ihr [X] mit [Y] — soweit alles korrekt?"
- "Nur zur Sicherheit: Ihr [X] ist [Y]?"
- "Dann waere [X] also [Y] bei Ihnen — richtig?"
- "Passt es, dass bei [X] [Y] steht?"
- "Darf ich kurz bestaetigen: [X] ist [Y]?"
- "Und zum [X] — Sie haben [Y] notiert?"

Wechsle bewusst: mal kurz, mal laenger. Mal mit Einleitung ("ich sehe hier",
"nur zur Sicherheit", "dann waere also"), mal direkt. Verbinde aufeinander-
folgende Bestaetigungen mit weichen Ueberleitungen ("Gut.", "Alles klar.",
"Perfekt.", "Super.", "Danke.") statt starr von Frage zu Frage zu springen.

## BESONDERE REGELN

- **NAME:** Falls der Name fehlt oder du ihn neu abfragen musst, frag nach dem VOLLSTAENDIGEN Namen in EINER Frage: "Wie lautet Ihr vollstaendiger Name?" Frag NIEMALS Vor- und Nachname getrennt. Wenn der Name schon bekannt ist, bestaetige ihn als Einheit ("Max Mustermann — richtig?"), nicht als zwei separate Bestaetigungen.
- **TELEFONNUMMER:** Die Telefonnummer bestaetigst du NIEMALS. Wenn der Lead den Anruf angenommen hat und antwortet, ist die Nummer offensichtlich korrekt.
- **E-MAIL:** Bestaetige die E-Mail im Gespraech (siehe separaten Block "E-MAIL-ADRESSE VORLESEN" weiter unten).

${kampagne.vapiPrompt || ''}${nameBlock}

# SPRACH-REGELN (IMMER EINHALTEN)

Du sprichst AUSSCHLIESSLICH Deutsch. Niemals Englisch, auch nicht einzelne Woerter.
- Datumsangaben nennst du auf Deutsch ausgeschrieben (z.B. "Donnerstag, der fuenfzehnte April")
- NIEMALS englische Datumsformate ("April fifteenth", "March 15th")
- Uhrzeiten auf Deutsch ("vierzehn Uhr dreissig" oder "halb drei am Nachmittag")
- Wochentage, Monate und Zahlen IMMER auf Deutsch
- Keine englischen Lehnwoerter wenn es ein deutsches Wort gibt ("Termin" statt "Appointment")

${datumsKontextErstellen()}

# LEAD-DATEN (${anzahlBestaetigungen} Punkte — ALLE muessen bestaetigt werden)

${leadDatenBlock}

**PFLICHT:** Jeder der oben genannten ${anzahlBestaetigungen} Punkte muss vom Lead
im Gespraech bestaetigt (oder korrigiert) worden sein, bevor du zur Terminvereinbarung
oder zum Abschluss kommen darfst. Ueberspringen eines Punkts gilt als Fehler.${erfassungsBlock}

# E-MAIL-ADRESSE VORLESEN

${lead.email ? `Die E-Mail des Leads ist: ${lead.email}

So sprichst du sie aus — lies diese Form **wortwoertlich** vor, ohne
irgendetwas zu veraendern, nicht buchstabieren, nicht umformulieren:

  "${emailZumVorlesen(lead.email)}"

Danach fragst du einmal zur Bestaetigung: "Ist das korrekt?"
Wenn der Lead unsicher ist oder eine Korrektur nennt, liest du die Form
ein zweites Mal langsam und deutlich vor — IMMER genau so wie oben.
Niemals die Woerter (Aett, Punkt, Bindestrich, Unterstrich, Plus,
Schraegstrich) weglassen oder durch andere ersetzen.` : 'Der Lead hat noch keine E-Mail angegeben — frag im Gespraech natuerlich danach und wiederhole sie zur Bestaetigung.'}

# FAQ-ANTWORTEN (IMMER KONSISTENT BEANTWORTEN)

- **Wie lange dauert der Termin?** Antworte: "Zwischen fuenfzehn und dreissig Minuten."`;

    const vapiPromptMessage = {
      role: 'system',
      content: kombinierterPrompt,
    };

    // Bestehende Messages (Gesprächshistorie) + kombinierter Prompt zusammenfuehren
    const bisherMessages = (assistantOverrides?.model as Record<string, unknown> | undefined)?.messages as Array<Record<string, string>> | undefined;
    const alleMessages = [
      vapiPromptMessage,
      ...(bisherMessages || []),
    ];

    if (!assistantOverrides) assistantOverrides = {};
    assistantOverrides = {
      ...assistantOverrides,
      model: {
        ...(assistantOverrides.model as Record<string, unknown> | undefined),
        messages: alleMessages,
      },
    };

    // VAPI-Tools + Server-URL hinzufügen
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
    if (apiBaseUrl.includes('localhost')) {
      logger.warn('API_BASE_URL enthält "localhost" – VAPI kann Tools und Webhooks nicht erreichen. Bitte eine öffentliche URL setzen.');
    }
    const vapiTools = [
      {
        type: 'function',
        function: {
          name: 'kalenderPruefen',
          strict: true,
          description: 'Prüft die Kalender-Verfügbarkeit zum gewünschten Zeitpunkt.',
          parameters: {
            type: 'object',
            required: ['gewuenschteZeit'],
            properties: { gewuenschteZeit: { type: 'string', description: 'Gewünschte Zeit im ISO-Format YYYY-MM-DDTHH:MM:SS, z.B. 2026-04-15T14:30:00 für den fünfzehnten April um halb drei nachmittags. Nutze IMMER das aktuelle Jahr aus dem Datums-Kontext.' } },
          },
        },
        messages: [{ type: 'request-start', content: 'Eine Sekunde bitte, ich schaue gerne kurz nach, ob ein Termin frei ist.', blocking: false }],
      },
      {
        type: 'function',
        function: {
          name: 'terminBuchen',
          strict: true,
          description: 'Bucht einen Termin zum bestätigten Zeitpunkt.',
          parameters: {
            type: 'object',
            required: ['gewuenschteZeit', 'telefonnummer', 'vorname', 'nachname'],
            properties: {
              gewuenschteZeit: { type: 'string', description: 'Bestätigte Zeit im ISO-Format YYYY-MM-DDTHH:MM:SS, z.B. 2026-04-15T14:30:00. Nutze IMMER das aktuelle Jahr aus dem Datums-Kontext.' },
              telefonnummer: { type: 'string', description: 'Telefonnummer des Leads' },
              vorname: { type: 'string', description: 'Vorname des Leads' },
              nachname: { type: 'string', description: 'Nachname des Leads' },
            },
          },
        },
        messages: [{ type: 'request-start', content: 'Ich stelle den Termin direkt ein.', blocking: false }],
      },
      {
        type: 'function',
        function: {
          name: 'rueckrufPlanen',
          strict: true,
          description: 'Plant einen Rückruf zu einem späteren Zeitpunkt.',
          parameters: {
            type: 'object',
            required: ['telefonnummer', 'rueckrufZeit'],
            properties: {
              telefonnummer: { type: 'string', description: 'Telefonnummer des Leads' },
              rueckrufZeit: { type: 'string', description: 'Gewünschte Rückrufzeit im ISO 8601 Format' },
            },
          },
        },
        messages: [{ type: 'request-start', blocking: false }],
        async: true,
      },
      {
        type: 'function',
        function: {
          name: 'leadDatenKorrigieren',
          strict: true,
          description: 'Korrigiert Lead-Daten wenn der Angerufene eine Angabe korrigiert.',
          parameters: {
            type: 'object',
            required: ['telefonnummer', 'datenTyp', 'neuerWert'],
            properties: {
              telefonnummer: { type: 'string', description: 'Telefonnummer des Leads' },
              datenTyp: { type: 'string', description: 'Art der Information: email, telefon, vorname, nachname' },
              neuerWert: { type: 'string', description: 'Der korrigierte Wert' },
            },
          },
        },
        messages: [{ type: 'request-start', blocking: false }],
        async: true,
      },
    ];

    // firstMessage mit Lead-Daten befüllen
    let firstMessage: string | undefined;
    if (kampagne.vapiErsteBotschaft) {
      firstMessage = kampagne.vapiErsteBotschaft
        .replace(/\{\{vorname\}\}/g, lead.vorname || '')
        .replace(/\{\{nachname\}\}/g, lead.nachname || '');
    }

    assistantOverrides = {
      ...assistantOverrides,
      ...(firstMessage ? { firstMessage } : {}),
      firstMessageMode: 'assistant-speaks-first',
      server: { url: `${apiBaseUrl}/api/v1/webhooks/vapi/tools`, timeoutSeconds: 20 },
      model: {
        ...(assistantOverrides?.model as Record<string, unknown> | undefined),
        provider: 'anthropic',
        model: 'claude-haiku-4-5-20251001', // Haiku fuer schnelle Voice-Interaktion (Sonnet war zu langsam)
        tools: vapiTools,
      },
      // Stimme (ElevenLabs) — optimiert fuer niedrige Latenz
      voice: {
        provider: '11labs',
        voiceId: kampagne.vapiVoiceId || 'EXAVITQu4vr4xnSDxMaL',
        model: 'eleven_turbo_v2_5',
        stability: 0.5,
        similarityBoost: 0.75,
        useSpeakerBoost: false,
        speed: 1.1,  // 10% schneller (war 1.05)
        style: 0.1,
        optimizeStreamingLatency: 3, // Max Latenz-Optimierung (war 2)
        inputPunctuationBoundaries: ['，', ';'],
        language: 'de',
      },
      // VAPI Assistant-Konfiguration
      endCallFunctionEnabled: true,
      silenceTimeoutSeconds: 30, // Mehr Toleranz fuer Denkpausen / Hintergrundrauschen (war 15)
      maxDurationSeconds: 600,   // 10 Min — Bestaetigungs-Demos mit vielen Feldern brauchen Zeit (war 300)
      backgroundDenoisingEnabled: true,
      backgroundSound: 'off',    // Kein synthetischer Hintergrund, maximale Verstaendlichkeit
      voicemailDetection: { provider: 'twilio' },
      transcriber: {
        model: 'nova-3',
        language: 'de',
        provider: 'deepgram',
        smartFormat: true,       // Bessere Erkennung von Zahlen, Datumsangaben, E-Mails
        endpointing: 180,        // Niedriger Endpointing-Threshold (ms) — reagiert schneller auch bei leisem Sprechen
        keywords: [              // Haeufige Begriffe in Versicherungs-/Lead-Gespraechen
          'Zahnzusatzversicherung:2',
          'Krankenkasse:2',
          'Termin:2',
          'Geburtsdatum:2',
          'Postleitzahl:2',
        ],
      },
      // Intelligenteres Erkennen wann der Lead mit Sprechen fertig ist
      startSpeakingPlan: {
        waitSeconds: 0.5,              // Kurze Wartezeit nach letztem Wort (default 0.4, ausreichend)
        smartEndpointingEnabled: true, // Deepgrams LLM-basierte Erkennung ob Satz wirklich beendet ist
        transcriptionEndpointingPlan: {
          onPunctuationSeconds: 0.1,   // Satzzeichen erkannt → quasi sofort reagieren
          onNoPunctuationSeconds: 1.2, // Ohne Satzzeichen → kurz warten ob noch was kommt
          onNumberSeconds: 0.4,        // Bei Zahlen (Geburtsdatum!) kurz warten ob noch mehr Ziffern folgen
        },
      },
      // Stop-Speaking: KI hoert sofort auf wenn Lead rein spricht
      stopSpeakingPlan: {
        numWords: 2,          // Erst nach 2 Woertern stoppen (vermeidet Abbruch bei "ähm", "ja")
        voiceSeconds: 0.2,    // Kurze Toleranz fuer Hintergrundgeraeusche
        backoffSeconds: 1.0,  // 1 Sek warten bevor KI weiterredet
      },
      // Nur ganze Abschieds-Saetze als End-Call-Trigger — ein einzelnes "Tschuess"
      // im Gespraech darf NICHT mehr versehentlich den Anruf beenden.
      endCallPhrases: [
        'Auf Wiederhören, einen schönen Tag noch.',
        'Auf Wiederhören und danke für Ihre Zeit.',
      ],
      ...(kampagne.vapiVoicemailNachricht ? { voicemailMessage: kampagne.vapiVoicemailNachricht } : {}),
    };

    // VAPI-Konfiguration ermitteln: erst Kunden-Integration, dann Kampagnen-Felder
    // (so kann ein Kunde seinen eigenen VAPI-Assistant + Phone-Number nutzen)
    const vapiKonfig = await integrationKonfigurationLesenMitFallback('vapi', kampagne.kundeId);
    const assistantId = vapiKonfig?.assistant_id || kampagne.vapiAssistantId!;
    const phoneNumberId = vapiKonfig?.phone_number_id || kampagne.vapiPhoneNumberId!;

    if (!assistantId || !phoneNumberId) {
      throw new Error(
        'VAPI Assistant-ID oder Phone-Number-ID fehlt. Bitte in der Kunden-Integration oder Kampagne konfigurieren.'
      );
    }

    // VAPI-Anruf starten
    const kundeName = [lead.vorname, lead.nachname].filter(Boolean).join(' ');
    const callId = await vapiAnrufStarten(
      lead.telefon!,
      assistantId,
      phoneNumberId,
      kundeName,
      {
        leadId: lead.id,
        kampagneId: versuch.kampagneId,
        kundeId: kampagne.kundeId || '',
        versuchNr: String(versuch.versuchNummer),
      },
      assistantOverrides,
      kampagne.kundeId
    );

    // Call-ID speichern (Lead + AnrufVersuch)
    await Promise.all([
      prisma.anrufVersuch.update({
        where: { id: anrufVersuchId },
        data: { vapiCallId: callId },
      }),
      prisma.lead.update({
        where: { id: lead.id },
        data: { vapiCallId: callId },
      }),
    ]);

    logger.info(`VAPI Anruf gestartet: Call ${callId} für Lead ${lead.id}`);

    // Polling starten – fragt VAPI alle 10 Sek ab bis der Anruf beendet ist
    await anrufPollingStarten(callId, anrufVersuchId, kampagne.kundeId || undefined);

    // Echtzeit-Event
    const io = socketServer();
    if (io) {
      io.to(`kampagne:${versuch.kampagneId}`).emit('anruf:gestartet', {
        leadId: lead.id,
        versuchNummer: versuch.versuchNummer,
        callId,
      });
    }

    // WICHTIG: Job ist fertig – VAPI Webhook liefert das Ergebnis async
  } catch (fehler) {
    logger.error(`Anruf fehlgeschlagen für Lead ${lead.id}:`, { error: fehler });

    await prisma.anrufVersuch.update({
      where: { id: anrufVersuchId },
      data: {
        status: 'fehler',
        fehlerNachricht: fehler instanceof Error ? fehler.message : String(fehler),
      },
    });

    await aktivitaetLoggen(lead.id, 'anruf_fehlgeschlagen',
      `Anrufversuch #${versuch.versuchNummer} fehlgeschlagen: ${fehler instanceof Error ? fehler.message : 'Unbekannter Fehler'}`);

    // Nächsten Versuch planen trotz Fehler
    await naechstenAnrufPlanen(lead.id, versuch.kampagneId, versuch.versuchNummer + 1);
  }
}

/**
 * Verarbeitet das Ergebnis eines VAPI-Anrufs (vom Webhook aufgerufen).
 */
export async function anrufErgebnisVerarbeiten(
  vapiCallId: string,
  transkript: string,
  endedReason: string,
  dauer?: number
) {
  const versuch = await prisma.anrufVersuch.findUnique({
    where: { vapiCallId },
    include: { lead: true },
  });

  if (!versuch) {
    logger.warn(`AnrufVersuch mit vapiCallId ${vapiCallId} nicht gefunden`);
    return;
  }

  const kampagne = await prisma.kampagne.findUnique({ where: { id: versuch.kampagneId } });
  if (!kampagne) return;

  // 1. Technische Fehler → direkt Retry planen, KEINE GPT-Analyse
  const technischeFehler = [
    'call-start-error-neither-assistant-nor-server-set',
    'assistant-error',
    'worker-shutdown',
    'assistant-join-timed-out',
    'assistant-request-returned-error',
  ];

  if (technischeFehler.includes(endedReason)) {
    logger.warn(`Technischer Fehler bei Anruf ${vapiCallId}: ${endedReason}`);

    await prisma.anrufVersuch.update({
      where: { id: versuch.id },
      data: {
        status: 'fehler',
        beendetAm: new Date(),
        dauerSekunden: dauer,
        fehlerNachricht: `Technischer Fehler: ${endedReason}`,
      },
    });

    await prisma.lead.update({
      where: { id: versuch.leadId },
      data: { vapiCallId: null },
    });

    await aktivitaetLoggen(versuch.leadId, 'anruf_fehlgeschlagen',
      `Anruf #${versuch.versuchNummer}: Technischer Fehler (${endedReason}) – nächster Versuch wird geplant`);

    await naechstenAnrufPlanen(versuch.leadId, versuch.kampagneId, versuch.versuchNummer + 1);
    return;
  }

  // 2. Voicemail-Backup-Check: Wenn VAPI "voicemail" meldet aber Transkript vorhanden
  if (endedReason === 'voicemail' && transkript && transkript.trim().length > 20) {
    logger.info(`Voicemail-Backup-Check für Anruf ${vapiCallId}`);
    const backupErgebnis = await voicemailBackupCheck(transkript);

    if (backupErgebnis === 'voicemail') {
      // Bestätigt als Voicemail → Retry planen + Follow-up
      await prisma.anrufVersuch.update({
        where: { id: versuch.id },
        data: {
          status: 'abgeschlossen',
          beendetAm: new Date(),
          dauerSekunden: dauer,
          ergebnis: 'voicemail',
          transkript,
          gptAnalyse: JSON.stringify({ verdict: 'voicemail', backupCheck: true }),
        },
      });

      await prisma.lead.update({
        where: { id: versuch.leadId },
        data: {
          status: 'Voicemail',
          gptZusammenfassung: 'Voicemail erreicht (Backup-Check bestätigt).',
          gptVerdict: 'voicemail',
          vapiCallId: null,
        },
      });

      await prisma.leadStatusHistorie.create({
        data: {
          leadId: versuch.leadId,
          alterStatus: versuch.lead.status,
          neuerStatus: 'Voicemail',
          grund: `VAPI Anruf #${versuch.versuchNummer}: Voicemail (Backup bestätigt)`,
        },
      });

      await aktivitaetLoggen(versuch.leadId, 'anruf_abgeschlossen',
        `Anruf #${versuch.versuchNummer}: Voicemail (Backup-Check bestätigt) – nächster Versuch wird geplant`);

      // Follow-up Mail senden wenn noch nicht fuer diesen Lead geschehen
      const bereitsVoicemailGesendet = await prisma.leadAktivitaet.findFirst({
        where: { leadId: versuch.leadId, typ: 'email_gesendet', beschreibung: { contains: 'Voicemail' } },
      });
      if (!bereitsVoicemailGesendet) {
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, 'voicemail');
      } else {
        logger.info(`Follow-up "voicemail" bereits gesendet — Duplikat uebersprungen (Lead ${versuch.leadId})`);
      }

      await naechstenAnrufPlanen(versuch.leadId, versuch.kampagneId, versuch.versuchNummer + 1);

      emitAnrufErgebnis(versuch.kampagneId, versuch.leadId, versuch.versuchNummer, 'voicemail');
      return;
    }

    // backupErgebnis === 'call' → War doch ein echtes Gespräch, weiter mit GPT-Analyse
    logger.info(`Voicemail-Backup-Check: War doch ein Gespräch – normale Analyse für ${vapiCallId}`);
  }

  // 3. Normale GPT-Analyse
  const analyse = await transkriptAnalysieren(transkript, endedReason, kampagne.vapiPrompt || undefined);

  // Versuch aktualisieren
  await prisma.anrufVersuch.update({
    where: { id: versuch.id },
    data: {
      status: 'abgeschlossen',
      beendetAm: new Date(),
      dauerSekunden: dauer,
      ergebnis: analyse.ergebnis,
      transkript,
      gptAnalyse: JSON.stringify({ summary: analyse.zusammenfassung, verdict: analyse.verdict }),
    },
  });

  logger.info(`Anruf ${vapiCallId} Ergebnis: ${analyse.verdict} → ${analyse.ergebnis} (Versuch #${versuch.versuchNummer})`);

  // Lead-Status basierend auf Ergebnis
  // WICHTIG: "interessiert" = Termin wurde TATSÄCHLICH gebucht (via terminBuchen Tool)
  // "rueckruf_geplant" = Kunde hat Interesse aber Termin steht noch aus → Follow-up
  const statusMap: Record<string, string> = {
    interessiert: 'Termin gebucht',
    rueckruf_geplant: 'Follow-up',
    nicht_interessiert: 'Nicht interessiert',
    falsche_nummer: 'Falsche Nummer',
    voicemail: 'Voicemail',
    hung_up: 'Hung Up',
    disconnected: 'Disconnected',
  };

  const neuerStatus = statusMap[analyse.ergebnis];

  // GPT-Felder + vapiCallId auf Lead aktualisieren
  await prisma.lead.update({
    where: { id: versuch.leadId },
    data: {
      gptZusammenfassung: analyse.zusammenfassung || null,
      gptVerdict: analyse.verdict,
      vapiCallId: null,
      ...(neuerStatus ? { status: neuerStatus } : {}),
    },
  });

  if (neuerStatus) {
    await prisma.leadStatusHistorie.create({
      data: {
        leadId: versuch.leadId,
        alterStatus: versuch.lead.status,
        neuerStatus,
        grund: `VAPI Anruf #${versuch.versuchNummer}: ${analyse.verdict}`,
      },
    });
    await aktivitaetLoggen(versuch.leadId, 'anruf_abgeschlossen',
      `Anruf #${versuch.versuchNummer}: ${analyse.verdict} → Status "${neuerStatus}"`);

    // Bei Endstatus: passende Follow-up-Mail senden + Team-Benachrichtigung + Sequenz beenden
    if (['interessiert', 'nicht_interessiert', 'falsche_nummer'].includes(analyse.ergebnis)) {
      // Status-spezifische Follow-up-Mail
      if (analyse.ergebnis === 'interessiert') {
        // Termin gebucht → Bestaetigungs-Mail mit Calendly-Link + Zusammenfassung
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, 'terminBestaetigung');
      } else if (analyse.ergebnis === 'nicht_interessiert') {
        // Nicht interessiert → freundliche Abschluss-Mail
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, 'nichtInteressiert');
      }
      // Bei "falsche_nummer" keine Mail an den Lead — die Adresse koennte falsch sein

      // Team-Benachrichtigung senden
      if (kampagne.benachrichtigungEmail) {
        await teamBenachrichtigungSenden(
          kampagne.benachrichtigungEmail,
          versuch.lead,
          neuerStatus,
          analyse.zusammenfassung,
          kampagne.kundeId
        );
      }
      emitAnrufErgebnis(versuch.kampagneId, versuch.leadId, versuch.versuchNummer, analyse.ergebnis);
      return;
    }
  }

  // Fehlerhaftes Auflegen: Assistant hat aufgelegt obwohl Gespräch lief → sofortiger Retry
  const assistantAufgelegt = ['assistant-ended-call', 'assistant-ended-call-after-message-spoken'];
  if (assistantAufgelegt.includes(endedReason) && ['hung_up', 'disconnected'].includes(analyse.ergebnis) && transkript && transkript.length > 50) {
    logger.info(`Fehlerhaftes Auflegen erkannt bei Anruf ${vapiCallId} – sofortiger Rückruf`);
    await aktivitaetLoggen(versuch.leadId, 'anruf_fehlgeschlagen',
      `Anruf #${versuch.versuchNummer}: Fehlerhaftes Auflegen (${endedReason}) – sofortiger Rückruf`);
    await sofortigenAnrufPlanen(versuch.leadId, versuch.kampagneId, versuch.versuchNummer + 1);
    emitAnrufErgebnis(versuch.kampagneId, versuch.leadId, versuch.versuchNummer, 'fehlerhaftes_auflegen');
    return;
  }

  // Bei voicemail/rueckruf/nicht_abgenommen/aufgelegt/hung_up/disconnected: nächsten Versuch planen
  const retryErgebnisse = ['voicemail', 'rueckruf_geplant', 'nicht_abgenommen', 'aufgelegt', 'hung_up', 'disconnected'];
  if (retryErgebnisse.includes(analyse.ergebnis)) {
    await aktivitaetLoggen(versuch.leadId, 'anruf_abgeschlossen',
      `Anruf #${versuch.versuchNummer}: ${analyse.verdict} – nächster Versuch wird geplant`);

    // Follow-up E-Mail senden: beim ERSTEN Mal dass dieses Ergebnis auftritt.
    // Pruefen ob fuer diesen Lead schon eine Follow-up-Mail zu diesem Grund gesendet wurde,
    // damit nicht nach jedem Retry eine Duplikat-Mail rausgeht.
    const bereitsGesendet = await prisma.leadAktivitaet.findFirst({
      where: {
        leadId: versuch.leadId,
        typ: 'email_gesendet',
        beschreibung: { contains: analyse.ergebnis === 'voicemail' ? 'Voicemail' : analyse.ergebnis === 'rueckruf_geplant' ? 'Rueckruf' : 'Verpasster Anruf' },
      },
    });
    if (!bereitsGesendet) {
      if (analyse.ergebnis === 'rueckruf_geplant') {
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, 'rueckruf');
      } else {
        const followUpGrund: FollowUpGrund = analyse.ergebnis === 'voicemail' ? 'voicemail' : 'verpasst';
        await followUpSenden(versuch.leadId, versuch.kampagneId, kampagne, followUpGrund);
      }
    } else {
      logger.info(`Follow-up fuer "${analyse.ergebnis}" bereits gesendet — Duplikat uebersprungen (Lead ${versuch.leadId})`);
    }

    // Nächsten Versuch planen
    await naechstenAnrufPlanen(versuch.leadId, versuch.kampagneId, versuch.versuchNummer + 1);
  }

  emitAnrufErgebnis(versuch.kampagneId, versuch.leadId, versuch.versuchNummer, analyse.ergebnis);
}

/**
 * Sendet Echtzeit-Event für Anruf-Ergebnis.
 */
function emitAnrufErgebnis(kampagneId: string, leadId: string, versuchNummer: number, ergebnis: string) {
  const io = socketServer();
  if (io) {
    io.to(`kampagne:${kampagneId}`).emit('anruf:ergebnis', {
      leadId,
      versuchNummer,
      ergebnis,
    });
  }
}

/**
 * Sendet Follow-up E-Mail und WhatsApp. Prüft Zeitfenster und verzögert ggf.
 */
async function followUpSenden(
  leadId: string,
  kampagneId: string,
  kampagne: KampagneFuerFollowUp,
  grund: FollowUpGrund
) {
  // Zeitfenster-Prüfung (Mo-Fr 09:00-20:00)
  if (!zeitfensterAktiv()) {
    const naechsterZeitpunkt = naechsterZeitfensterbeginn();
    const delay = Math.max(naechsterZeitpunkt.getTime() - Date.now(), 1000);
    await followUpQueue.add('follow-up-senden', { leadId, kampagneId, grund }, {
      delay,
      jobId: `followup-${leadId}-${grund}-${Date.now()}`,
    });
    logger.info(`Follow-up "${grund}" verzögert bis ${naechsterZeitpunkt.toISOString()} für Lead ${leadId}`);
    return;
  }

  await followUpDirektSenden(leadId, kampagne, grund);
}

/**
 * Gemeinsamer Typ fuer alle Stellen die Follow-ups triggern.
 */
type KampagneFuerFollowUp = {
  emailAktiviert: boolean;
  whatsappAktiviert: boolean;
  emailTemplateVerpasst: string | null;
  emailTemplateVoicemail: string | null;
  emailTemplateUnerreichbar: string | null;
  emailTemplateTerminBestaetigung: string | null;
  emailTemplateRueckruf: string | null;
  emailTemplateNichtInteressiert: string | null;
  whatsappTemplateVerpasst: string | null;
  whatsappTemplateUnerreichbar: string | null;
  whatsappTemplateNichtInteressiert: string | null;
  whatsappKanalId: string | null;
  // Meta-Anbieter-Felder
  whatsappAnbieter?: string;
  whatsappMetaPhoneNumberId?: string | null;
  whatsappTemplateVerpasstName?: string | null;
  whatsappTemplateVerpasstSprache?: string | null;
  whatsappTemplateUnerreichbarName?: string | null;
  whatsappTemplateUnerreichbarSprache?: string | null;
  whatsappTemplateNichtInteressiertName?: string | null;
  whatsappTemplateNichtInteressiertSprache?: string | null;
};

/**
 * Sendet Follow-up direkt (ohne Zeitfenster-Prüfung). Wird vom Worker aufgerufen.
 */
export async function followUpDirektSenden(
  leadId: string,
  kampagne: KampagneFuerFollowUp,
  grund: FollowUpGrund
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      kampagne: { select: { name: true, kundeId: true, calendlyLink: true } },
      zugewiesener: { select: { vorname: true, nachname: true } },
      felddaten: { include: { feld: { select: { feldname: true } } } },
    },
  });

  if (!lead) return;

  // Template-IDs nach Grund auswählen — jeder Grund hat sein eigenes Template
  // mit Fallback auf das Unerreichbar-Template falls das spezifische fehlt
  const emailTemplateId: string | null = {
    verpasst: kampagne.emailTemplateVerpasst,
    voicemail: kampagne.emailTemplateVoicemail,
    unerreichbar: kampagne.emailTemplateUnerreichbar,
    nichtInteressiert: kampagne.emailTemplateNichtInteressiert || kampagne.emailTemplateUnerreichbar,
    terminBestaetigung: kampagne.emailTemplateTerminBestaetigung,
    rueckruf: kampagne.emailTemplateRueckruf || kampagne.emailTemplateVerpasst,
  }[grund];

  const whatsappTemplateId: string | null = {
    verpasst: kampagne.whatsappTemplateVerpasst,
    voicemail: null,
    unerreichbar: kampagne.whatsappTemplateUnerreichbar,
    nichtInteressiert: kampagne.whatsappTemplateNichtInteressiert,
    terminBestaetigung: null,
    rueckruf: null,
  }[grund];

  const grundBezeichnung: Record<FollowUpGrund, string> = {
    verpasst: 'Verpasster Anruf',
    voicemail: 'Voicemail',
    unerreichbar: 'Nicht erreichbar',
    nichtInteressiert: 'Nicht interessiert',
    terminBestaetigung: 'Termin-Bestaetigung',
    rueckruf: 'Rueckruf-Bestaetigung',
  };

  // E-Mail senden (wenn aktiviert + Template vorhanden) – nutzt SMTP des Kunden
  // Diagnose-Logging: stille Skips sind frueher unbemerkt geblieben, jetzt explizit
  if (!kampagne.emailAktiviert) {
    logger.info(`Follow-up "${grund}" uebersprungen: emailAktiviert=false (Lead ${leadId})`);
  } else if (!lead.email) {
    logger.info(`Follow-up "${grund}" uebersprungen: Lead hat keine E-Mail-Adresse (Lead ${leadId})`);
  } else if (!emailTemplateId) {
    logger.warn(`Follow-up "${grund}" uebersprungen: kein E-Mail-Template fuer diesen Grund hinterlegt (Kampagne pruefen, Lead ${leadId})`);
  } else {
    try {
      await emailMitTemplateSenden(emailTemplateId, lead, undefined, lead.kampagne?.kundeId || null);
      await aktivitaetLoggen(leadId, 'email_gesendet',
        `Follow-up E-Mail gesendet: ${grundBezeichnung[grund]}`);
      logger.info(`Follow-up E-Mail "${grund}" erfolgreich gesendet an ${lead.email} (Lead ${leadId})`);
    } catch (fehler) {
      logger.error('Follow-up E-Mail fehlgeschlagen:', { leadId, grund, error: fehler });
    }
  }

  // WhatsApp senden (wenn aktiviert + Handynummer) — Anbieter-Dispatch: Meta oder Superchat
  if (kampagne.whatsappAktiviert && lead.telefon && istHandynummer(lead.telefon)) {
    const anbieter = kampagne.whatsappAnbieter || 'superchat';

    if (anbieter === 'meta') {
      // Meta WhatsApp Cloud API
      const metaTemplateName: string | null = {
        verpasst: kampagne.whatsappTemplateVerpasstName,
        voicemail: null,
        unerreichbar: kampagne.whatsappTemplateUnerreichbarName,
        nichtInteressiert: kampagne.whatsappTemplateNichtInteressiertName,
        terminBestaetigung: null,
        rueckruf: kampagne.whatsappTemplateVerpasstName,
      }[grund] || null;

      const metaTemplateSprache: string = ({
        verpasst: kampagne.whatsappTemplateVerpasstSprache,
        voicemail: null,
        unerreichbar: kampagne.whatsappTemplateUnerreichbarSprache,
        nichtInteressiert: kampagne.whatsappTemplateNichtInteressiertSprache,
        terminBestaetigung: null,
        rueckruf: kampagne.whatsappTemplateVerpasstSprache,
      }[grund]) || 'de';

      if (metaTemplateName && kampagne.whatsappMetaPhoneNumberId) {
        try {
          const whatsappKonfig = await integrationKonfigurationLesenMitFallback('whatsapp', lead.kampagne?.kundeId || null);
          if (whatsappKonfig?.zugriffstoken) {
            const { metaTemplateNachrichtSenden } = await import('./whatsapp-meta.dienst');
            const ergebnis = await metaTemplateNachrichtSenden(
              kampagne.whatsappMetaPhoneNumberId,
              lead.telefon,
              metaTemplateName,
              metaTemplateSprache,
              [{ name: 'vorname', wert: lead.vorname || '' }],
              whatsappKonfig.zugriffstoken,
            );
            if (ergebnis.erfolg) {
              await aktivitaetLoggen(leadId, 'whatsapp_gesendet',
                `Follow-up WhatsApp (Meta) gesendet: ${grundBezeichnung[grund]}`);
            } else {
              logger.error('Meta WhatsApp-Versand fehlgeschlagen', { leadId, grund, fehler: ergebnis.fehler });
            }
          } else {
            logger.warn(`Meta WhatsApp nicht verbunden fuer Kunde ${lead.kampagne?.kundeId}`);
          }
        } catch (fehler) {
          logger.error('Follow-up WhatsApp (Meta) fehlgeschlagen:', { leadId, grund, error: fehler });
        }
      }
    } else {
      // Superchat (bestehender Flow)
      if (whatsappTemplateId && kampagne.whatsappKanalId) {
        try {
          const superchatKonfig = await integrationKonfigurationLesenMitFallback('superchat', lead.kampagne?.kundeId || null);
          if (superchatKonfig?.api_schluessel) {
            const basisUrl = superchatKonfig.basis_url || 'https://api.superchat.de';
            let kontakt = await superchatKontaktFinden(
              { telefon: lead.telefon, email: lead.email },
              superchatKonfig.api_schluessel,
              basisUrl
            );

            if (!kontakt) {
              kontakt = await superchatKontaktErstellen(
                { telefon: lead.telefon, vorname: lead.vorname || undefined, nachname: lead.nachname || undefined, email: lead.email || undefined },
                superchatKonfig.api_schluessel,
                basisUrl
              );
            }

            if (kontakt) {
              await superchatTemplateNachrichtSenden(
                kontakt.id,
                kampagne.whatsappKanalId,
                whatsappTemplateId,
                [{ name: 'vorname', wert: lead.vorname || '' }],
                superchatKonfig.api_schluessel,
                basisUrl
              );
              await aktivitaetLoggen(leadId, 'whatsapp_gesendet',
                `Follow-up WhatsApp gesendet: ${grundBezeichnung[grund]}`);
            }
          }
        } catch (fehler) {
          logger.error('Follow-up WhatsApp fehlgeschlagen:', { leadId, grund, error: fehler });
        }
      }
    }
  }
}

/**
 * Liefert die aktuellen Berlin-Zeit-Komponenten unabhängig von der Server-Zeitzone.
 */
function berlinZeitKomponenten(jetzt: Date): {
  jahr: number;
  monat: number; // 0-basiert
  tag: number;
  stunde: number;
  minute: number;
  wochentag: number; // 0=So .. 6=Sa
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const teile = Object.fromEntries(
    fmt.formatToParts(jetzt).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const wochentagMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return {
    jahr: parseInt(teile.year, 10),
    monat: parseInt(teile.month, 10) - 1,
    tag: parseInt(teile.day, 10),
    stunde: parseInt(teile.hour === '24' ? '0' : teile.hour, 10),
    minute: parseInt(teile.minute, 10),
    wochentag: wochentagMap[teile.weekday] ?? 0,
  };
}

/**
 * Konstruiert ein Date-Objekt, das einer bestimmten Wanduhr-Zeit in Berlin entspricht.
 * Behandelt DST-Übergänge korrekt durch Iterationsschritt.
 */
function berlinDatumErzeugen(jahr: number, monat: number, tag: number, stunde: number, minute: number): Date {
  // Erster Versuch: interpretiere Berlin-Wanduhr als wäre es UTC
  let utcKandidat = new Date(Date.UTC(jahr, monat, tag, stunde, minute, 0));
  // Zweimal iterieren reicht für DST: bestimme den tatsächlichen Berlin-Offset und korrigiere
  for (let i = 0; i < 2; i++) {
    const sieht = berlinZeitKomponenten(utcKandidat);
    const sollMinuten = stunde * 60 + minute;
    const istMinuten = sieht.stunde * 60 + sieht.minute;
    const diffMinuten = sollMinuten - istMinuten;
    if (diffMinuten === 0) break;
    utcKandidat = new Date(utcKandidat.getTime() + diffMinuten * 60 * 1000);
  }
  return utcKandidat;
}

/**
 * Berechnet die nächste Anrufzeit basierend auf Zeitslots.
 * Alle Berechnungen erfolgen in Europe/Berlin und sind unabhängig von der Server-Zeitzone.
 */
function naechsteAnrufzeitBerechnen(zeitslots?: AnrufZeitslot[]): Date {
  const jetzt = new Date();
  const slots = zeitslots?.length ? zeitslots : [
    { stunde: 9, minute: 0 },
    { stunde: 12, minute: 30 },
    { stunde: 17, minute: 0 },
    { stunde: 18, minute: 0 },
    { stunde: 19, minute: 0 },
  ];
  const verzoegerung = 10;

  const berlin = berlinZeitKomponenten(jetzt);
  const aktuelleMinuten = berlin.stunde * 60 + berlin.minute;

  // Hilfsfunktion: Slot an einem bestimmten Berlin-Tag (relativ zum heutigen) erzeugen
  const slotAnTag = (tageVerschiebung: number, slot: AnrufZeitslot): Date => {
    // Tag-Verschiebung über UTC-Datum, dann zurück in Berlin-Komponenten
    const verschoben = new Date(Date.UTC(berlin.jahr, berlin.monat, berlin.tag + tageVerschiebung));
    const verschobenKomp = berlinZeitKomponenten(verschoben);
    return berlinDatumErzeugen(
      verschobenKomp.jahr,
      verschobenKomp.monat,
      verschobenKomp.tag,
      slot.stunde,
      slot.minute,
    );
  };

  // Wochenende → Montag erste Zeit
  if (berlin.wochentag === 0 || berlin.wochentag === 6) {
    const tageAbstand = berlin.wochentag === 0 ? 1 : 2;
    return zufallsVerzoegerungAnwenden(slotAnTag(tageAbstand, slots[0]), verzoegerung);
  }

  // Nach 21:00 → morgen erste Zeit
  if (aktuelleMinuten >= 21 * 60) {
    return zufallsVerzoegerungAnwenden(slotAnTag(1, slots[0]), verzoegerung);
  }

  // Vor 09:00 → heute erste Zeit
  if (aktuelleMinuten < 9 * 60) {
    return zufallsVerzoegerungAnwenden(slotAnTag(0, slots[0]), verzoegerung);
  }

  // Nächste verfügbare Anrufzeit heute finden
  for (const slot of slots) {
    const slotMinuten = slot.stunde * 60 + slot.minute;
    if (slotMinuten > aktuelleMinuten) {
      return zufallsVerzoegerungAnwenden(slotAnTag(0, slot), verzoegerung);
    }
  }

  // Alle Zeiten heute vorbei → morgen erste Zeit
  return zufallsVerzoegerungAnwenden(slotAnTag(1, slots[0]), verzoegerung);
}

/**
 * Fügt eine zufällige Verzögerung von ±X Minuten hinzu.
 */
function zufallsVerzoegerungAnwenden(datum: Date, maxMinuten: number): Date {
  const zufall = Math.floor(Math.random() * maxMinuten * 2) - maxMinuten;
  const ergebnis = new Date(datum.getTime() + zufall * 60 * 1000);
  return ergebnis;
}

async function aktivitaetLoggen(
  leadId: string,
  typ: 'anruf_gestartet' | 'anruf_abgeschlossen' | 'anruf_fehlgeschlagen' | 'email_gesendet' | 'whatsapp_gesendet',
  beschreibung: string
) {
  await prisma.leadAktivitaet.create({
    data: { leadId, typ, beschreibung },
  });
}

/**
 * Sendet eine Team-Benachrichtigungs-Email bei Lead-Endstatus.
 * Nutzt SMTP des Kunden falls konfiguriert, sonst globalen Fallback.
 */
async function teamBenachrichtigungSenden(
  empfaengerEmail: string,
  lead: { vorname: string | null; nachname: string | null; email: string | null; telefon: string | null; anrufVersucheAnzahl: number },
  neuerStatus: string,
  zusammenfassung?: string | null,
  kundeId?: string | null
) {
  const leadName = [lead.vorname, lead.nachname].filter(Boolean).join(' ') || 'Unbekannt';

  try {
    await emailSenden({
      an: empfaengerEmail,
      kundeId,
      betreff: `LeadFlow: ${leadName} – ${neuerStatus}`,
      html: `
        <div style="font-family: 'Manrope', Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2b4c;">Lead-Status Update</h2>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Name</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${leadName}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">E-Mail</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${lead.email || '—'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Telefon</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${lead.telefon || '—'}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Status</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #ff8049; font-weight: 600;">${neuerStatus}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">Anrufversuche</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${lead.anrufVersucheAnzahl}</td></tr>
          </table>
          ${zusammenfassung ? `<div style="background: #f5f7fa; padding: 16px; border-radius: 8px; margin-top: 16px;"><h3 style="margin: 0 0 8px; color: #1a2b4c;">KI-Zusammenfassung</h3><p style="margin: 0; color: #3f4e65;">${zusammenfassung}</p></div>` : ''}
        </div>
      `,
    });
    logger.info(`Team-Benachrichtigung gesendet an ${empfaengerEmail}: ${leadName} – ${neuerStatus}`);
  } catch (fehler) {
    logger.error('Team-Benachrichtigung fehlgeschlagen:', { empfaengerEmail, fehler });
  }
}

/**
 * Erzeugt einen ausfuehrlichen Datums-Kontext fuer das LLM, damit es
 * relative Datumsangaben ("morgen", "naechste Woche") in konkrete Daten
 * aufloesen kann ohne zu halluzinieren. Alles in Berlin-Zeit.
 */
function datumsKontextErstellen(): string {
  const wochentage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  const jetzt = new Date();
  const heute = berlinZeitKomponenten(jetzt);

  // Hilfsfunktion: Datum X Tage nach heute formatieren
  const tagOffset = (offset: number): { wochentag: string; iso: string; deutsch: string } => {
    const d = new Date(Date.UTC(heute.jahr, heute.monat, heute.tag + offset));
    const k = berlinZeitKomponenten(d);
    return {
      wochentag: wochentage[k.wochentag],
      iso: `${k.jahr}-${String(k.monat + 1).padStart(2, '0')}-${String(k.tag).padStart(2, '0')}`,
      deutsch: `${wochentage[k.wochentag]}, der ${k.tag}. ${monate[k.monat]} ${k.jahr}`,
    };
  };

  // Berechne "naechster Montag", "naechster Dienstag", ... immer in der NAECHSTEN Woche (>= 7 Tage entfernt)
  const naechsteWocheTag = (zielWochentag: number): { iso: string; deutsch: string } => {
    let offset = 7 - heute.wochentag + zielWochentag;
    if (offset < 7) offset += 7;
    return tagOffset(offset);
  };

  const heuteFmt = tagOffset(0);
  const morgenFmt = tagOffset(1);
  const uebermorgenFmt = tagOffset(2);
  const inEinerWoche = tagOffset(7);
  const inZweiWochen = tagOffset(14);
  const naechsteWocheMo = naechsteWocheTag(1);
  const naechsteWocheDi = naechsteWocheTag(2);
  const naechsteWocheMi = naechsteWocheTag(3);
  const naechsteWocheDo = naechsteWocheTag(4);
  const naechsteWocheFr = naechsteWocheTag(5);

  return `# Aktueller Zeit-Kontext (NUTZE DIESE WERTE fuer ALLE Datumsberechnungen)

Heute ist ${heuteFmt.deutsch}.
Aktuelle Uhrzeit in Berlin: ${String(heute.stunde).padStart(2, '0')}:${String(heute.minute).padStart(2, '0')} Uhr.

Aktuelles Jahr: ${heute.jahr}
Aktueller Monat: ${monate[heute.monat]}
Aktueller Wochentag: ${wochentage[heute.wochentag]}

## Relative Datumsaufloesung (verwende diese Werte 1:1 wenn der Lead solche Begriffe nutzt)

- "heute" = ${heuteFmt.deutsch} (ISO: ${heuteFmt.iso})
- "morgen" = ${morgenFmt.deutsch} (ISO: ${morgenFmt.iso})
- "uebermorgen" = ${uebermorgenFmt.deutsch} (ISO: ${uebermorgenFmt.iso})
- "in einer Woche" = ${inEinerWoche.deutsch} (ISO: ${inEinerWoche.iso})
- "in zwei Wochen" = ${inZweiWochen.deutsch} (ISO: ${inZweiWochen.iso})
- "naechsten Montag" = ${naechsteWocheMo.deutsch} (ISO: ${naechsteWocheMo.iso})
- "naechsten Dienstag" = ${naechsteWocheDi.deutsch} (ISO: ${naechsteWocheDi.iso})
- "naechsten Mittwoch" = ${naechsteWocheMi.deutsch} (ISO: ${naechsteWocheMi.iso})
- "naechsten Donnerstag" = ${naechsteWocheDo.deutsch} (ISO: ${naechsteWocheDo.iso})
- "naechsten Freitag" = ${naechsteWocheFr.deutsch} (ISO: ${naechsteWocheFr.iso})

## ISO-Format fuer Tool-Aufrufe (kalenderPruefen, terminBuchen)

Wenn du die Tools aufrufst, MUSST du das Format YYYY-MM-DDTHH:MM:SS verwenden.
Beispiel fuer morgen um halb drei nachmittags: ${morgenFmt.iso}T14:30:00

WICHTIG: Das aktuelle Jahr ist ${heute.jahr}, NICHT 2024 oder 2025. Alle Termine fallen in ${heute.jahr} (oder spaeter).`;
}
