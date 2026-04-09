// API-Antwort-Typen
export interface ApiErfolg<T> {
  erfolg: true;
  daten: T;
}

export interface ApiFehler {
  erfolg: false;
  fehler: string;
  details?: Array<{ feld: string; nachricht: string }>;
  code: string;
}

export type ApiAntwort<T> = ApiErfolg<T> | ApiFehler;

export interface PaginierteAntwort<T> {
  eintraege: T[];
  gesamt: number;
  seite: number;
  proSeite: number;
}

// Benutzer
export interface Benutzer {
  id: string;
  email: string;
  vorname: string;
  nachname: string;
  rolle: 'admin' | 'mitarbeiter';
  aktiv: boolean;
  letzterLogin: string | null;
  erstelltAm: string;
}

// Kampagne
export interface Kampagne {
  id: string;
  name: string;
  beschreibung: string | null;
  status: 'aktiv' | 'pausiert' | 'archiviert';
  triggerTyp: 'facebook_lead_ads' | 'webhook' | 'email' | 'whatsapp' | 'webformular';
  webhookSlug: string | null;
  pipelineSpalten: string[];
  vapiAktiviert: boolean;
  vapiAssistantId: string | null;
  vapiPhoneNumberId: string | null;
  vapiPrompt: string | null;
  vapiErsteBotschaft: string | null;
  vapiVoicemailNachricht: string | null;
  maxAnrufVersuche: number;
  anrufZeitslots: Array<{ stunde: number; minute: number }>;
  emailAktiviert: boolean;
  whatsappAktiviert: boolean;
  benachrichtigungEmail: string | null;
  calendlyLink: string | null;
  branche: string | null;
  produkt: string | null;
  zielgruppe: string | null;
  ton: string | null;
  kiName: string | null;
  kiGeschlecht: string | null;
  kiSprachstil: string | null;
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
  kundeId: string | null;
  kunde?: { id: string; name: string } | null;
  erstelltAm: string;
  statistiken?: {
    gesamtLeads: number;
    leadsHeute: number;
    conversionRate: number;
  };
}

// Lead
export interface Lead {
  id: string;
  kampagneId: string;
  vorname: string | null;
  nachname: string | null;
  email: string | null;
  telefon: string | null;
  status: string;
  quelle: string | null;
  istDuplikat: boolean;
  anrufVersucheAnzahl: number;
  letzterAnrufAm: string | null;
  naechsterAnrufAm: string | null;
  gptZusammenfassung: string | null;
  gptVerdict: string | null;
  vapiCallId: string | null;
  erstelltAm: string;
  felder?: Record<string, string>;
  zugewiesenAn?: {
    id: string;
    name: string;
  } | null;
}

// Lead-Notiz
export interface LeadNotiz {
  id: string;
  inhalt: string;
  autor: string;
  erstelltAm: string;
}

// Automatisierung
export interface Automatisierung {
  id: string;
  name: string;
  beschreibung: string | null;
  aktiv: boolean;
  triggerTyp: 'lead_eingetroffen' | 'status_geaendert' | 'inaktivitaet' | 'zeitplan';
  schritte: AutomatisierungsSchritt[];
}

export interface AutomatisierungsSchritt {
  id: string;
  reihenfolge: number;
  aktionTyp: 'email_senden' | 'whatsapp_senden' | 'status_setzen' | 'benachrichtigung' | 'warten' | 'warten_bis_uhrzeit' | 'vapi_anruf' | 'vapi_sequenz';
  konfiguration: Record<string, unknown>;
}

// E-Mail-Template
export interface EmailTemplate {
  id: string;
  name: string;
  betreff: string;
  htmlInhalt: string;
  textInhalt: string | null;
  variablen: string[];
  version: number;
  erstelltAm: string;
}

// Termin
export interface Termin {
  id: string;
  leadId: string | null;
  titel: string;
  beschreibung: string | null;
  beginnAm: string;
  endeAm: string | null;
  quelle: 'calendly' | 'google_calendar' | 'manuell' | null;
  meetingLink: string | null;
}

// Status-Farben (Light + Dark)
export const statusFarben: Record<string, string> = {
  'Neu': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  'Anruf läuft': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  'Voicemail': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  'Follow-up': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  'Nicht erreichbar': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  'Falsche Nummer': 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400',
  'Nicht interessiert': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  'Termin gebucht': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  'Hung Up': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  'Disconnected': 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
  'WhatsApp erhalten': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
};

// Dynamische Status-Farbe ermitteln (inkl. "Attempt #N")
export function statusFarbeErmitteln(status: string): string {
  if (statusFarben[status]) return statusFarben[status];
  if (status.startsWith('Attempt #')) {
    return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400';
  }
  return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
}

// Kunde
export interface Kunde {
  id: string;
  name: string;
  kontaktperson: string | null;
  email: string | null;
  telefon: string | null;
  branche: string | null;
  notizen: string | null;
  erstelltAm: string;
  statistiken?: {
    kampagnenAnzahl: number;
    gesamtLeads: number;
    conversionRate: number;
  };
}

// Prompt-Vorlage
export interface PromptVorlage {
  id: string;
  name: string;
  beschreibung: string | null;
  branche: string;
  produkt: string | null;
  vapiPrompt: string;
  version: number;
  erstelltAm: string;
}

// Integrations-Status
export interface IntegrationStatus {
  name: string;
  typ: string;
  konfiguriert: boolean;
  aktiv: boolean;
}

// KI-Generierung
export interface KiGenerierungErgebnis {
  quelle?: 'bibliothek' | 'generiert';
  vorlagenId?: string;
  vorlagenBranche?: string;
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

export const quellenFarben: Record<string, string> = {
  'facebook_lead_ads': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'webhook': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  'email': 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'whatsapp': 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'webformular': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};
