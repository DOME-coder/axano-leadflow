'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ArrowLeft, ArrowRight, Globe, Mail, MessageSquare, FileText, Megaphone, Phone, Sparkles } from 'lucide-react';
import { benutzeKampagneErstellen, benutzeKiGenerierung } from '@/hooks/benutze-kampagnen';
import { benutzeTemplates } from '@/hooks/benutze-templates';
import { benutzeTemplateErstellen } from '@/hooks/benutze-templates';
import { benutzeKunden, benutzeKundeErstellen } from '@/hooks/benutze-kunden';
import { KanalKonfiguration, type KanalKonfigurationWerte } from '@/components/kampagnen/kanal-konfiguration';
import { useToastStore } from '@/stores/toast-store';

const schritte = [
  { id: 1, bezeichnung: 'Info' },
  { id: 2, bezeichnung: 'Trigger' },
  { id: 3, bezeichnung: 'Felder' },
  { id: 4, bezeichnung: 'Kanäle' },
  { id: 5, bezeichnung: 'Übersicht' },
];

const triggerOptionen = [
  { wert: 'webhook', bezeichnung: 'Webhook', beschreibung: 'Generischer HTTP-Webhook', icon: Globe },
  { wert: 'facebook_lead_ads', bezeichnung: 'Facebook Lead Ads', beschreibung: 'Facebook Lead Ad Formulare', icon: Megaphone },
  { wert: 'email', bezeichnung: 'E-Mail', beschreibung: 'IMAP E-Mail-Eingang', icon: Mail },
  { wert: 'whatsapp', bezeichnung: 'WhatsApp', beschreibung: 'Superchat WhatsApp-Eingang', icon: MessageSquare },
  { wert: 'webformular', bezeichnung: 'Webformular', beschreibung: 'Eingebettetes Formular', icon: FileText },
];

interface FeldDefinition {
  feldname: string;
  bezeichnung: string;
  feldtyp: string;
  pflichtfeld: boolean;
}

interface FacebookFeldMapping {
  facebookFeldname: string;
  kampagneFeldname: string;
}

const standardKanalWerte: KanalKonfigurationWerte = {
  vapiAktiviert: false,
  vapiAssistantId: '',
  vapiPhoneNumberId: '',
  vapiPrompt: '',
  vapiErsteBotschaft: '',
  vapiVoicemailNachricht: '',
  maxAnrufVersuche: 11,
  emailAktiviert: true,
  emailTemplateVerpasst: '',
  emailTemplateVoicemail: '',
  emailTemplateUnerreichbar: '',
  emailTemplateTerminBestaetigung: '',
  emailTemplateRueckruf: '',
  emailTemplateNichtInteressiert: '',
  whatsappAktiviert: false,
  whatsappKanalId: '',
  whatsappTemplateVerpasst: '',
  whatsappTemplateUnerreichbar: '',
  whatsappTemplateNichtInteressiert: '',
  kiName: '',
  kiGeschlecht: '',
  kiSprachstil: 'freundlich',
  benachrichtigungEmail: '',
  calendlyLink: '',
};

export default function NeueKampagneSeite() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Kampagnen-Wizard wird geladen...</div></div>}>
      <NeueKampagneInhalt />
    </Suspense>
  );
}

function NeueKampagneInhalt() {
  const router = useRouter();
  const suchParams = useSearchParams();
  const erstellen = benutzeKampagneErstellen();
  const { data: templates } = benutzeTemplates();
  const { data: kunden } = benutzeKunden();
  const kundeErstellen = benutzeKundeErstellen();
  const { toastAnzeigen } = useToastStore();

  const [aktuellerSchritt, setAktuellerSchritt] = useState(0);
  const [kundeId, setKundeId] = useState(suchParams.get('kundeId') || '');
  const [neuerKundeName, setNeuerKundeName] = useState('');
  const [name, setName] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [triggerTyp, setTriggerTyp] = useState('');
  const [felder, setFelder] = useState<FeldDefinition[]>([]);
  const [kanalWerte, setKanalWerte] = useState<KanalKonfigurationWerte>(standardKanalWerte);
  const [fehler, setFehler] = useState('');

  // KI-Generierung
  const [branche, setBranche] = useState('');
  const [produkt, setProdukt] = useState('');
  const [zielgruppe, setZielgruppe] = useState('');
  const [ton, setTon] = useState('freundlich, persönlich');
  const [zusatzFelderText, setZusatzFelderText] = useState('');
  const [kiGeneriert, setKiGeneriert] = useState(false);
  const [kiQuelle, setKiQuelle] = useState<'bibliothek' | 'generiert' | null>(null);
  const [kiBranche, setKiBranche] = useState('');
  const kiGenerierung = benutzeKiGenerierung();
  const templateErstellen = benutzeTemplateErstellen();

  // Facebook-Feldmapping
  const [facebookFeldMappings, setFacebookFeldMappings] = useState<FacebookFeldMapping[]>([]);

  const kiGenerieren = async () => {
    setFehler('');
    try {
      // Zusatzfelder aus komma-separiertem Text parsen
      const zusatzFelder = zusatzFelderText
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);

      const ergebnis = await kiGenerierung.mutateAsync({
        branche, produkt, zielgruppe, ton,
        kiName: kanalWerte.kiName || undefined,
        kiGeschlecht: kanalWerte.kiGeschlecht || undefined,
        kiSprachstil: kanalWerte.kiSprachstil || undefined,
        zusatzFelder: zusatzFelder.length > 0 ? zusatzFelder : undefined,
      });

      // VAPI-Prompt + ersteBotschaft + voicemailNachricht setzen
      setKanalWerte((prev) => ({
        ...prev,
        vapiAktiviert: true,
        vapiPrompt: ergebnis.vapiPrompt,
        vapiErsteBotschaft: ergebnis.ersteBotschaft || '',
        vapiVoicemailNachricht: ergebnis.voicemailNachricht || '',
        emailAktiviert: true,
        whatsappAktiviert: true,
      }));

      // E-Mail-Templates in DB erstellen und IDs setzen — eines pro Anruf-Ergebnis
      const templateIds: Record<string, string> = {};
      const templateMap = {
        verpassterAnruf: { name: `${name || branche} – Verpasster Anruf`, ...ergebnis.emailTemplates.verpassterAnruf },
        voicemailFollowup: { name: `${name || branche} – Voicemail`, ...ergebnis.emailTemplates.voicemailFollowup },
        unerreichbar: { name: `${name || branche} – Nicht erreichbar`, ...ergebnis.emailTemplates.unerreichbar },
        terminBestaetigung: { name: `${name || branche} – Termin-Bestätigung`, ...ergebnis.emailTemplates.terminBestaetigung },
        rueckruf: { name: `${name || branche} – Rückruf-Bestätigung`, ...ergebnis.emailTemplates.rueckruf },
        nichtInteressiert: { name: `${name || branche} – Nicht interessiert`, ...ergebnis.emailTemplates.nichtInteressiert },
      };

      for (const [schluessel, daten] of Object.entries(templateMap)) {
        if (!daten.betreff || !daten.html) continue; // Falls die KI ein Template ausgelassen hat
        try {
          const template = await templateErstellen.mutateAsync({
            name: daten.name,
            betreff: daten.betreff,
            htmlInhalt: daten.html,
          });
          templateIds[schluessel] = template.id;
        } catch {
          // Template-Erstellung fehlgeschlagen, aber weiter
        }
      }

      setKanalWerte((prev) => ({
        ...prev,
        emailTemplateVerpasst: templateIds.verpassterAnruf || '',
        emailTemplateVoicemail: templateIds.voicemailFollowup || '',
        emailTemplateUnerreichbar: templateIds.unerreichbar || '',
        emailTemplateTerminBestaetigung: templateIds.terminBestaetigung || '',
        emailTemplateRueckruf: templateIds.rueckruf || '',
        emailTemplateNichtInteressiert: templateIds.nichtInteressiert || '',
      }));

      // WhatsApp-Templates speichern
      setKanalWerte((prev) => ({
        ...prev,
        whatsappTemplateVerpasst: ergebnis.whatsappTemplates.anrufFehlgeschlagen,
        whatsappTemplateUnerreichbar: ergebnis.whatsappTemplates.unerreichbar,
        whatsappTemplateNichtInteressiert: ergebnis.whatsappTemplates.nichtInteressiert || '',
      }));

      // Formularfelder setzen
      setFelder(ergebnis.formularfelder.map((f) => ({
        feldname: f.feldname,
        bezeichnung: f.bezeichnung,
        feldtyp: f.feldtyp,
        pflichtfeld: f.pflichtfeld,
      })));

      setKiGeneriert(true);
      setKiQuelle(ergebnis.quelle || 'generiert');
      setKiBranche(ergebnis.vorlagenBranche || branche);
      toastAnzeigen('erfolg', 'KI-Inhalte erfolgreich generiert');
    } catch {
      setFehler('KI-Generierung fehlgeschlagen. Bitte prüfen Sie den Anthropic API-Schlüssel unter Einstellungen → Integrationen.');
      toastAnzeigen('fehler', 'KI-Generierung fehlgeschlagen');
    }
  };

  const kanalWertAendern = (schluessel: keyof KanalKonfigurationWerte, wert: unknown) => {
    setKanalWerte((prev) => ({ ...prev, [schluessel]: wert }));
  };

  const feldHinzufuegen = () => {
    setFelder([...felder, {
      feldname: '',
      bezeichnung: '',
      feldtyp: 'text',
      pflichtfeld: false,
    }]);
  };

  const feldAktualisieren = (index: number, feld: Partial<FeldDefinition>) => {
    const aktualisiert = [...felder];
    aktualisiert[index] = { ...aktualisiert[index], ...feld };
    if (feld.bezeichnung && !aktualisiert[index].feldname) {
      aktualisiert[index].feldname = feld.bezeichnung
        .toLowerCase()
        .replace(/[äöüß]/g, (c) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c] || c))
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    }
    setFelder(aktualisiert);
  };

  const feldEntfernen = (index: number) => {
    setFelder(felder.filter((_, i) => i !== index));
  };

  const weiter = () => {
    setFehler('');
    if (aktuellerSchritt === 0 && !name.trim()) {
      setFehler('Bitte geben Sie einen Kampagnennamen ein');
      return;
    }
    if (aktuellerSchritt === 0 && kundeId === '__neu__' && !neuerKundeName.trim()) {
      setFehler('Bitte geben Sie einen Kundennamen ein');
      return;
    }
    if (aktuellerSchritt === 1 && !triggerTyp) {
      setFehler('Bitte wählen Sie einen Trigger-Typ');
      return;
    }
    // VAPI-Validierung entfernt: Assistant-ID und Phone-Number-ID können
    // jetzt auch aus der Kunden-Integration kommen (Multi-Tenant). Wenn sie
    // hier leer bleiben und der Kunde keine VAPI-Integration hat, schlägt
    // der erste Anruf mit einer klaren Fehlermeldung fehl.
    setAktuellerSchritt((s) => Math.min(s + 1, schritte.length - 1));
  };

  const absenden = async () => {
    try {
      // Neuen Kunden erstellen falls nötig
      let finalKundeId = kundeId === '__neu__' ? null : (kundeId || null);
      if (kundeId === '__neu__' && neuerKundeName.trim()) {
        const neuerKunde = await kundeErstellen.mutateAsync({ name: neuerKundeName.trim() });
        finalKundeId = neuerKunde.id;
      }

      // Trigger-Konfiguration mit Facebook-Feldmappings
      const triggerKonfiguration: Record<string, unknown> = {};
      if (triggerTyp === 'facebook_lead_ads' && facebookFeldMappings.length > 0) {
        triggerKonfiguration.feldMappings = facebookFeldMappings.filter(
          (m) => m.facebookFeldname.trim() && m.kampagneFeldname.trim()
        );
      }

      const kampagne = await erstellen.mutateAsync({
        name: name.trim(),
        beschreibung: beschreibung.trim() || undefined,
        triggerTyp,
        triggerKonfiguration: Object.keys(triggerKonfiguration).length > 0 ? triggerKonfiguration : undefined,
        kundeId: finalKundeId,
        branche: branche.trim() || null,
        produkt: produkt.trim() || null,
        zielgruppe: zielgruppe.trim() || null,
        ton: ton.trim() || null,
        kiName: kanalWerte.kiName || null,
        kiGeschlecht: kanalWerte.kiGeschlecht || null,
        kiSprachstil: kanalWerte.kiSprachstil || null,
        felder: felder
          .filter((f) => f.bezeichnung && f.feldname)
          .map((f, i) => ({ ...f, reihenfolge: i })),
        vapiAktiviert: kanalWerte.vapiAktiviert,
        vapiAssistantId: kanalWerte.vapiAssistantId || null,
        vapiPhoneNumberId: kanalWerte.vapiPhoneNumberId || null,
        vapiPrompt: kanalWerte.vapiPrompt || null,
        vapiErsteBotschaft: kanalWerte.vapiErsteBotschaft || null,
        vapiVoicemailNachricht: kanalWerte.vapiVoicemailNachricht || null,
        maxAnrufVersuche: kanalWerte.maxAnrufVersuche,
        emailAktiviert: kanalWerte.emailAktiviert,
        emailTemplateVerpasst: kanalWerte.emailTemplateVerpasst || null,
        emailTemplateVoicemail: kanalWerte.emailTemplateVoicemail || null,
        emailTemplateUnerreichbar: kanalWerte.emailTemplateUnerreichbar || null,
        emailTemplateTerminBestaetigung: kanalWerte.emailTemplateTerminBestaetigung || null,
        emailTemplateRueckruf: kanalWerte.emailTemplateRueckruf || null,
        emailTemplateNichtInteressiert: kanalWerte.emailTemplateNichtInteressiert || null,
        whatsappAktiviert: kanalWerte.whatsappAktiviert,
        whatsappKanalId: kanalWerte.whatsappKanalId || null,
        whatsappTemplateVerpasst: kanalWerte.whatsappTemplateVerpasst || null,
        whatsappTemplateUnerreichbar: kanalWerte.whatsappTemplateUnerreichbar || null,
        whatsappTemplateNichtInteressiert: kanalWerte.whatsappTemplateNichtInteressiert || null,
        benachrichtigungEmail: kanalWerte.benachrichtigungEmail || null,
        calendlyLink: kanalWerte.calendlyLink || null,
      });

      router.push(`/kampagnen/${kampagne.id}/leads`);
    } catch (err) {
      const fehlerNachricht = err instanceof Error ? err.message : 'Unbekannter Fehler';
      console.error('Kampagne erstellen fehlgeschlagen:', err);
      setFehler(`Fehler beim Erstellen der Kampagne: ${fehlerNachricht}`);
      toastAnzeigen('fehler', `Fehler beim Erstellen der Kampagne: ${fehlerNachricht}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-einblenden">
      <h1 className="text-2xl font-bold ax-titel mb-2">Neue Kampagne</h1>
      <p className="text-sm ax-text-sekundaer mb-8">
        Erstellen Sie eine neue Lead-Kampagne in wenigen Schritten
      </p>

      {/* Fortschrittsbalken */}
      <div className="flex items-center gap-0 mb-8">
        {schritte.map((schritt, index) => (
          <div key={schritt.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                index < aktuellerSchritt
                  ? 'bg-axano-orange text-white'
                  : index === aktuellerSchritt
                  ? 'bg-axano-primaer text-white'
                  : 'ax-karte-erhoeht ax-text-tertiaer border ax-rahmen'
              }`}>
                {index < aktuellerSchritt ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span className={`text-xs font-medium ${
                index === aktuellerSchritt ? 'ax-titel' : 'ax-text-tertiaer'
              }`}>
                {schritt.bezeichnung}
              </span>
            </div>
            {index < schritte.length - 1 && (
              <div className={`flex-1 h-0.5 mb-5 mx-2 ${
                index < aktuellerSchritt ? 'bg-axano-orange' : 'ax-rahmen bg-[var(--rahmen)]'
              }`} />
            )}
          </div>
        ))}
      </div>

      {fehler && (
        <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 text-sm rounded-lg p-3 mb-4">
          {fehler}
        </div>
      )}

      <div className={aktuellerSchritt === 3 ? '' : 'ax-karte rounded-xl p-6'}>
        {/* Schritt 1: Info + KI-Generierung */}
        {aktuellerSchritt === 0 && (
          <div className="space-y-4">
            {/* Kunden-Auswahl */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium ax-text">Kunde</label>
              <select
                value={kundeId}
                onChange={(e) => {
                  setKundeId(e.target.value);
                  setNeuerKundeName('');
                }}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              >
                <option value="">Kein Kunde (intern)</option>
                {kunden?.eintraege.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
                <option value="__neu__">+ Neuen Kunden anlegen</option>
              </select>
            </div>
            {kundeId === '__neu__' && (
              <div className="space-y-1.5 pl-3 border-l-2 border-axano-orange/30">
                <label className="text-sm font-medium ax-text">Neuer Kundenname *</label>
                <input
                  type="text"
                  value={neuerKundeName}
                  onChange={(e) => setNeuerKundeName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                  placeholder="z.B. Sanato Versicherungsmakler"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium ax-text">Kampagnenname *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe transition-all"
                placeholder="z.B. Pferdeversicherung Facebook Q2"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium ax-text">Beschreibung</label>
              <textarea
                value={beschreibung}
                onChange={(e) => setBeschreibung(e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe transition-all resize-none"
                rows={2}
                placeholder="Optionale Beschreibung der Kampagne"
              />
            </div>

            {/* KI-Generierung */}
            <div className="border-t ax-rahmen-leicht pt-4 mt-2">
              <h3 className="text-sm font-semibold ax-titel mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-axano-orange" />
                KI-Auto-Generierung
              </h3>
              <p className="text-xs ax-text-sekundaer mb-3">
                Füllen Sie die Felder aus und lassen Sie die KI alle Inhalte generieren: VAPI-Prompt, E-Mail-Templates, WhatsApp-Templates und Formularfelder.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium ax-text">Branche *</label>
                  <input
                    type="text"
                    value={branche}
                    onChange={(e) => setBranche(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                    placeholder="z.B. Pferdeversicherung"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium ax-text">Produkt/Dienstleistung *</label>
                  <input
                    type="text"
                    value={produkt}
                    onChange={(e) => setProdukt(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                    placeholder="z.B. Krankenversicherung für Pferde"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium ax-text">Zielgruppe *</label>
                  <input
                    type="text"
                    value={zielgruppe}
                    onChange={(e) => setZielgruppe(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                    placeholder="z.B. Pferdebesitzer in Deutschland"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium ax-text">Ton *</label>
                  <input
                    type="text"
                    value={ton}
                    onChange={(e) => setTon(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                    placeholder="z.B. freundlich, persönlich"
                  />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <label className="text-xs font-medium ax-text">Zusätzliche Datenfelder (telefonisch abfragen)</label>
                <input
                  type="text"
                  value={zusatzFelderText}
                  onChange={(e) => setZusatzFelderText(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                  placeholder="z.B. Rasse des Pferdes, Geschlecht, Geburtsdatum, Vorerkrankungen"
                />
                <p className="text-xs ax-text-tertiaer">Komma-separiert. Diese Felder werden im VAPI-Prompt und als Formularfelder verwendet.</p>
              </div>
              <button
                onClick={kiGenerieren}
                disabled={!branche || !produkt || !zielgruppe || !ton || kiGenerierung.isPending}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-axano-orange hover:bg-orange-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {kiGenerierung.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    KI generiert Inhalte...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Mit KI generieren
                  </>
                )}
              </button>

              {kiGeneriert && (
                <div className={`mt-3 text-xs rounded-lg p-3 space-y-1 ${
                  kiQuelle === 'bibliothek'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                }`}>
                  <p className="font-semibold">
                    {kiQuelle === 'bibliothek'
                      ? `Prompt aus Bibliothek geladen (${kiBranche})`
                      : 'Inhalte erfolgreich generiert und in Bibliothek gespeichert'}
                  </p>
                  <p>VAPI-Prompt ({kanalWerte.vapiPrompt.length} Zeichen)</p>
                  {kiQuelle !== 'bibliothek' && (
                    <>
                      <p>3 E-Mail-Templates erstellt</p>
                      <p>3 WhatsApp-Templates erstellt</p>
                      <p>{felder.length} Formularfelder generiert</p>
                      {kanalWerte.vapiErsteBotschaft && <p>Erste Begrüßungsnachricht generiert</p>}
                      {kanalWerte.vapiVoicemailNachricht && <p>Voicemail-Nachricht generiert</p>}
                    </>
                  )}
                  <p className="text-xs opacity-70 mt-1">Alle Inhalte sind in den folgenden Schritten bearbeitbar.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schritt 2: Trigger */}
        {aktuellerSchritt === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              {triggerOptionen.map((option) => (
                <button
                  key={option.wert}
                  onClick={() => setTriggerTyp(option.wert)}
                  className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left ${
                    triggerTyp === option.wert
                      ? 'border-axano-orange bg-orange-50/50 dark:bg-orange-900/20'
                      : 'ax-rahmen border-[var(--rahmen)] hover:border-[var(--text-tertiaer)]'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    triggerTyp === option.wert ? 'bg-axano-orange text-white' : 'ax-karte-erhoeht ax-text'
                  }`}>
                    <option.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm ax-titel">{option.bezeichnung}</p>
                    <p className="text-xs ax-text-sekundaer">{option.beschreibung}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Facebook-Feldmapping */}
            {triggerTyp === 'facebook_lead_ads' && (
              <div className="border-t ax-rahmen-leicht pt-4">
                <h3 className="text-sm font-semibold ax-titel mb-2">Facebook-Formularfeld-Mapping</h3>
                <p className="text-xs ax-text-sekundaer mb-3">
                  Ordnen Sie Facebook-Formularfelder den Kampagnenfeldern zu. Standard-Felder (first_name, last_name, email, phone_number) werden automatisch gemappt.
                </p>
                {facebookFeldMappings.map((mapping, index) => (
                  <div key={index} className="flex gap-2 items-center mb-2">
                    <input
                      type="text"
                      value={mapping.facebookFeldname}
                      onChange={(e) => {
                        const aktualisiert = [...facebookFeldMappings];
                        aktualisiert[index] = { ...aktualisiert[index], facebookFeldname: e.target.value };
                        setFacebookFeldMappings(aktualisiert);
                      }}
                      className="flex-1 px-3 py-2 text-sm rounded-lg ax-eingabe"
                      placeholder="Facebook-Feldname (z.B. geschlecht_deines_pferdes)"
                    />
                    <span className="ax-text-tertiaer text-xs">→</span>
                    <input
                      type="text"
                      value={mapping.kampagneFeldname}
                      onChange={(e) => {
                        const aktualisiert = [...facebookFeldMappings];
                        aktualisiert[index] = { ...aktualisiert[index], kampagneFeldname: e.target.value };
                        setFacebookFeldMappings(aktualisiert);
                      }}
                      className="flex-1 px-3 py-2 text-sm rounded-lg ax-eingabe"
                      placeholder="Kampagnenfeld (z.B. pferd_geschlecht)"
                    />
                    <button
                      onClick={() => setFacebookFeldMappings(facebookFeldMappings.filter((_, i) => i !== index))}
                      className="text-red-400 hover:text-red-600 p-1 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => setFacebookFeldMappings([...facebookFeldMappings, { facebookFeldname: '', kampagneFeldname: '' }])}
                  className="w-full border-2 border-dashed ax-rahmen border-[var(--rahmen)] ax-text-sekundaer hover:border-axano-orange hover:text-axano-orange rounded-lg py-2 text-xs font-medium transition-all"
                >
                  + Feldmapping hinzufügen
                </button>
              </div>
            )}
          </div>
        )}

        {/* Schritt 3: Felder */}
        {aktuellerSchritt === 2 && (
          <div className="space-y-4">
            <p className="text-sm ax-text-sekundaer">
              Definieren Sie kampagnenspezifische Felder (optional). Standardfelder (Name, E-Mail, Telefon) werden automatisch erfasst.
            </p>
            {felder.map((feld, index) => (
              <div key={index} className="flex gap-3 items-start p-3 ax-karte-erhoeht rounded-lg">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={feld.bezeichnung}
                    onChange={(e) => feldAktualisieren(index, { bezeichnung: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                    placeholder="Bezeichnung (z.B. Rasse des Pferdes)"
                  />
                  <div className="flex gap-2">
                    <select
                      value={feld.feldtyp}
                      onChange={(e) => feldAktualisieren(index, { feldtyp: e.target.value })}
                      className="px-3 py-2 text-sm rounded-lg ax-eingabe"
                    >
                      <option value="text">Text</option>
                      <option value="zahl">Zahl</option>
                      <option value="email">E-Mail</option>
                      <option value="telefon">Telefon</option>
                      <option value="datum">Datum</option>
                      <option value="auswahl">Auswahl</option>
                      <option value="ja_nein">Ja/Nein</option>
                      <option value="mehrzeilig">Mehrzeilig</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs ax-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={feld.pflichtfeld}
                        onChange={(e) => feldAktualisieren(index, { pflichtfeld: e.target.checked })}
                        className="rounded border-axano-sky-blue"
                      />
                      Pflicht
                    </label>
                  </div>
                </div>
                <button
                  onClick={() => feldEntfernen(index)}
                  className="text-red-400 hover:text-red-600 p-1 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={feldHinzufuegen}
              className="w-full border-2 border-dashed ax-rahmen border-[var(--rahmen)] ax-text-sekundaer hover:border-axano-orange hover:text-axano-orange rounded-lg py-3 text-sm font-medium transition-all"
            >
              + Feld hinzufügen
            </button>
          </div>
        )}

        {/* Schritt 4: Kanäle & Automatisierung */}
        {aktuellerSchritt === 3 && (
          <KanalKonfiguration
            werte={kanalWerte}
            onAendern={kanalWertAendern}
            templates={templates}
          />
        )}

        {/* Schritt 5: Übersicht */}
        {aktuellerSchritt === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold ax-titel">Zusammenfassung</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b ax-rahmen-leicht">
                <span className="ax-text-sekundaer">Name</span>
                <span className="font-medium ax-titel">{name}</span>
              </div>
              {beschreibung && (
                <div className="flex justify-between py-2 border-b ax-rahmen-leicht">
                  <span className="ax-text-sekundaer">Beschreibung</span>
                  <span className="font-medium ax-titel">{beschreibung}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b ax-rahmen-leicht">
                <span className="ax-text-sekundaer">Trigger</span>
                <span className="font-medium ax-titel">
                  {triggerOptionen.find((t) => t.wert === triggerTyp)?.bezeichnung}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b ax-rahmen-leicht">
                <span className="ax-text-sekundaer">Zusatzfelder</span>
                <span className="font-medium ax-titel">{felder.filter((f) => f.bezeichnung).length}</span>
              </div>
              <div className="flex justify-between py-2 border-b ax-rahmen-leicht">
                <span className="ax-text-sekundaer flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> VAPI KI-Anrufe</span>
                <span className={`font-medium ${kanalWerte.vapiAktiviert ? 'text-green-600' : 'ax-text-tertiaer'}`}>
                  {kanalWerte.vapiAktiviert ? `Aktiv (max. ${kanalWerte.maxAnrufVersuche} Versuche)` : 'Deaktiviert'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b ax-rahmen-leicht">
                <span className="ax-text-sekundaer flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> E-Mail Follow-up</span>
                <span className={`font-medium ${kanalWerte.emailAktiviert ? 'text-green-600' : 'ax-text-tertiaer'}`}>
                  {kanalWerte.emailAktiviert ? 'Aktiv' : 'Deaktiviert'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b ax-rahmen-leicht">
                <span className="ax-text-sekundaer flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> WhatsApp</span>
                <span className={`font-medium ${kanalWerte.whatsappAktiviert ? 'text-green-600' : 'ax-text-tertiaer'}`}>
                  {kanalWerte.whatsappAktiviert ? 'Aktiv' : 'Deaktiviert'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => aktuellerSchritt === 0 ? router.back() : setAktuellerSchritt((s) => s - 1)}
          className="flex items-center gap-2 border ax-rahmen-leicht ax-text ax-hover font-medium px-5 py-2.5 rounded-lg transition-all text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          {aktuellerSchritt === 0 ? 'Abbrechen' : 'Zurück'}
        </button>

        {aktuellerSchritt < schritte.length - 1 ? (
          <button
            onClick={weiter}
            className="flex items-center gap-2 bg-axano-primaer hover:bg-axano-sekundaer text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm"
          >
            Weiter
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={absenden}
            disabled={erstellen.isPending}
            className="flex items-center gap-2 bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm disabled:opacity-50"
          >
            {erstellen.isPending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Kampagne erstellen
          </button>
        )}
      </div>
    </div>
  );
}
