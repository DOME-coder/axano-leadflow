'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Copy, Check, PhoneCall, ExternalLink } from 'lucide-react';
import { benutzeKampagne } from '@/hooks/benutze-kampagnen';
import { benutzeKampagneEinstellungenSpeichern } from '@/hooks/benutze-kampagne-einstellungen';
import { benutzeFacebookForms } from '@/hooks/benutze-kunden-integrationen';
import { benutzeTemplates } from '@/hooks/benutze-templates';
import { KanalKonfiguration, type KanalKonfigurationWerte } from '@/components/kampagnen/kanal-konfiguration';
import { FelderVerwaltung } from '@/components/kampagnen/felder-verwaltung';
import type { KampagnenFeld } from '@/hooks/benutze-kampagnen-felder';
import { useToastStore } from '@/stores/toast-store';
import { benutzeKampagneKundenWaechter } from '@/hooks/benutze-kampagne-kunden-waechter';

const standardWerte: KanalKonfigurationWerte = {
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
  whatsappAnbieter: 'superchat' as const,
  whatsappKanalId: '',
  whatsappTemplateVerpasst: '',
  whatsappTemplateUnerreichbar: '',
  whatsappTemplateNichtInteressiert: '',
  whatsappMetaPhoneNumberId: '',
  whatsappTemplateVerpasstName: '',
  whatsappTemplateVerpasstSprache: 'de',
  whatsappTemplateUnerreichbarName: '',
  whatsappTemplateUnerreichbarSprache: 'de',
  whatsappTemplateNichtInteressiertName: '',
  whatsappTemplateNichtInteressiertSprache: 'de',
  kiName: '',
  kiGeschlecht: '',
  kiSprachstil: 'freundlich',
  benachrichtigungEmail: '',
  calendlyLink: '',
};

export default function KampagneEinstellungenSeite({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: kampagne } = benutzeKampagne(id);
  benutzeKampagneKundenWaechter(kampagne?.kundeId);
  const { data: templates } = benutzeTemplates();
  const speichern = benutzeKampagneEinstellungenSpeichern();

  const { toastAnzeigen } = useToastStore();
  const [werte, setWerte] = useState<KanalKonfigurationWerte>(standardWerte);
  const [kopiert, setKopiert] = useState(false);
  const [demoKopiert, setDemoKopiert] = useState(false);
  const [istDemoVerfuegbar, setIstDemoVerfuegbar] = useState(false);

  useEffect(() => {
    if (kampagne) {
      setIstDemoVerfuegbar(((kampagne as unknown as Record<string, unknown>).istDemoVerfuegbar as boolean) ?? false);
    }
  }, [kampagne]);

  useEffect(() => {
    if (kampagne) {
      setWerte({
        vapiAktiviert: kampagne.vapiAktiviert ?? false,
        vapiAssistantId: kampagne.vapiAssistantId ?? '',
        vapiPhoneNumberId: kampagne.vapiPhoneNumberId ?? '',
        vapiPrompt: kampagne.vapiPrompt ?? '',
        vapiErsteBotschaft: kampagne.vapiErsteBotschaft ?? '',
        vapiVoicemailNachricht: kampagne.vapiVoicemailNachricht ?? '',
        maxAnrufVersuche: kampagne.maxAnrufVersuche ?? 11,
        emailAktiviert: kampagne.emailAktiviert ?? true,
        emailTemplateVerpasst: kampagne.emailTemplateVerpasst ?? '',
        emailTemplateVoicemail: kampagne.emailTemplateVoicemail ?? '',
        emailTemplateUnerreichbar: kampagne.emailTemplateUnerreichbar ?? '',
        emailTemplateTerminBestaetigung: kampagne.emailTemplateTerminBestaetigung ?? '',
        emailTemplateRueckruf: kampagne.emailTemplateRueckruf ?? '',
        emailTemplateNichtInteressiert: kampagne.emailTemplateNichtInteressiert ?? '',
        whatsappAktiviert: kampagne.whatsappAktiviert ?? false,
        whatsappAnbieter: kampagne.whatsappAnbieter ?? 'superchat',
        whatsappKanalId: kampagne.whatsappKanalId ?? '',
        whatsappTemplateVerpasst: kampagne.whatsappTemplateVerpasst ?? '',
        whatsappTemplateUnerreichbar: kampagne.whatsappTemplateUnerreichbar ?? '',
        whatsappTemplateNichtInteressiert: kampagne.whatsappTemplateNichtInteressiert ?? '',
        whatsappMetaPhoneNumberId: kampagne.whatsappMetaPhoneNumberId ?? '',
        whatsappTemplateVerpasstName: kampagne.whatsappTemplateVerpasstName ?? '',
        whatsappTemplateVerpasstSprache: kampagne.whatsappTemplateVerpasstSprache ?? 'de',
        whatsappTemplateUnerreichbarName: kampagne.whatsappTemplateUnerreichbarName ?? '',
        whatsappTemplateUnerreichbarSprache: kampagne.whatsappTemplateUnerreichbarSprache ?? 'de',
        whatsappTemplateNichtInteressiertName: kampagne.whatsappTemplateNichtInteressiertName ?? '',
        whatsappTemplateNichtInteressiertSprache: kampagne.whatsappTemplateNichtInteressiertSprache ?? 'de',
        kiName: kampagne.kiName ?? '',
        kiGeschlecht: kampagne.kiGeschlecht ?? '',
        kiSprachstil: kampagne.kiSprachstil ?? 'freundlich',
        benachrichtigungEmail: kampagne.benachrichtigungEmail ?? '',
        calendlyLink: kampagne.calendlyLink ?? '',
      });
    }
  }, [kampagne]);

  const wertAendern = (schluessel: keyof KanalKonfigurationWerte, wert: unknown) => {
    setWerte((prev) => ({ ...prev, [schluessel]: wert }));
  };

  const triggerBezeichnungen: Record<string, string> = {
    facebook_lead_ads: 'Facebook Lead Ads',
    webhook: 'Webhook',
    email: 'E-Mail',
    whatsapp: 'WhatsApp',
    webformular: 'Webformular',
  };

  const webhookUrl = kampagne?.webhookSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook/${kampagne.webhookSlug}`
    : null;

  const webhookKopieren = async () => {
    if (webhookUrl) {
      await navigator.clipboard.writeText(webhookUrl);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    }
  };

  const demoUrl = kampagne?.webhookSlug && typeof window !== 'undefined'
    ? `${window.location.origin}/demo/${kampagne.webhookSlug}`
    : null;

  const demoLinkKopieren = async () => {
    if (demoUrl) {
      await navigator.clipboard.writeText(demoUrl);
      setDemoKopiert(true);
      setTimeout(() => setDemoKopiert(false), 2000);
    }
  };

  const demoFreigabeUmschalten = async (neuerWert: boolean) => {
    try {
      await speichern.mutateAsync({ id, istDemoVerfuegbar: neuerWert });
      setIstDemoVerfuegbar(neuerWert);
      toastAnzeigen('erfolg', neuerWert ? 'Demo freigeschaltet' : 'Demo deaktiviert');
    } catch {
      toastAnzeigen('fehler', 'Demo-Status konnte nicht geaendert werden');
    }
  };

  const handleSpeichern = async () => {
    try {
      await speichern.mutateAsync({
        id,
        vapiAktiviert: werte.vapiAktiviert,
        vapiAssistantId: werte.vapiAssistantId || null,
        vapiPhoneNumberId: werte.vapiPhoneNumberId || null,
        vapiPrompt: werte.vapiPrompt || null,
        maxAnrufVersuche: werte.maxAnrufVersuche,
        emailAktiviert: werte.emailAktiviert,
        emailTemplateVerpasst: werte.emailTemplateVerpasst || null,
        emailTemplateVoicemail: werte.emailTemplateVoicemail || null,
        emailTemplateUnerreichbar: werte.emailTemplateUnerreichbar || null,
        emailTemplateTerminBestaetigung: werte.emailTemplateTerminBestaetigung || null,
        emailTemplateRueckruf: werte.emailTemplateRueckruf || null,
        emailTemplateNichtInteressiert: werte.emailTemplateNichtInteressiert || null,
        whatsappAktiviert: werte.whatsappAktiviert,
        whatsappAnbieter: werte.whatsappAnbieter,
        whatsappKanalId: werte.whatsappKanalId || null,
        whatsappTemplateVerpasst: werte.whatsappTemplateVerpasst || null,
        whatsappTemplateUnerreichbar: werte.whatsappTemplateUnerreichbar || null,
        whatsappMetaPhoneNumberId: werte.whatsappMetaPhoneNumberId || null,
        whatsappTemplateVerpasstName: werte.whatsappTemplateVerpasstName || null,
        whatsappTemplateVerpasstSprache: werte.whatsappTemplateVerpasstSprache || null,
        whatsappTemplateUnerreichbarName: werte.whatsappTemplateUnerreichbarName || null,
        whatsappTemplateUnerreichbarSprache: werte.whatsappTemplateUnerreichbarSprache || null,
        whatsappTemplateNichtInteressiertName: werte.whatsappTemplateNichtInteressiertName || null,
        whatsappTemplateNichtInteressiertSprache: werte.whatsappTemplateNichtInteressiertSprache || null,
        kiName: werte.kiName || null,
        kiGeschlecht: werte.kiGeschlecht || null,
        kiSprachstil: werte.kiSprachstil || null,
        benachrichtigungEmail: werte.benachrichtigungEmail || null,
        calendlyLink: werte.calendlyLink || null,
      });
      toastAnzeigen('erfolg', 'Einstellungen gespeichert');
    } catch {
      toastAnzeigen('fehler', 'Fehler beim Speichern der Einstellungen');
    }
  };

  return (
    <div className="animate-einblenden max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/kampagnen/${id}/leads`}
          className="p-1.5 rounded-lg ax-text-tertiaer ax-hover transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold ax-titel">Kampagnen-Einstellungen</h1>
          <p className="text-xs ax-text-sekundaer">{kampagne?.name}</p>
        </div>
      </div>

      {/* Trigger-Info */}
      {kampagne && (
        <div className="ax-karte rounded-xl p-5 mb-5">
          <h3 className="text-sm font-semibold ax-titel mb-3">Trigger</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {triggerBezeichnungen[kampagne.triggerTyp] || kampagne.triggerTyp}
            </span>
          </div>
          {/* Facebook Form-Auswahl (nachtraeglich aenderbar) */}
          {kampagne.triggerTyp === 'facebook_lead_ads' && kampagne.kundeId && (
            <FacebookFormAuswahl
              kundeId={kampagne.kundeId}
              aktuelleFormIds={((kampagne as unknown as Record<string, unknown>).triggerKonfiguration as Record<string, unknown>)?.form_ids as string[] || []}
              kampagneId={id}
            />
          )}
          {webhookUrl && (
            <div className="mt-3">
              <label className="text-xs font-medium ax-text-sekundaer mb-1 block">Webhook-URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs ax-karte-erhoeht rounded-lg px-3 py-2 ax-text break-all select-all">
                  {webhookUrl}
                </code>
                <button
                  onClick={webhookKopieren}
                  className="p-2 rounded-lg ax-hover ax-text-sekundaer transition-all flex-shrink-0"
                  title="Kopieren"
                >
                  {kopiert ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Demo-Anruf Freigabe */}
      {kampagne && (
        <div className="ax-karte rounded-xl p-5 mb-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-axano-orange/10 flex items-center justify-center flex-shrink-0">
                <PhoneCall className="w-4 h-4 text-axano-orange" strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="text-sm font-semibold ax-titel">Demo-Anruf freigeben</h3>
                <p className="text-xs ax-text-sekundaer mt-0.5">
                  Erzeugt eine oeffentliche URL, mit der Interessenten die KI dieser Kampagne live testen koennen.
                </p>
              </div>
            </div>
            <button
              onClick={() => demoFreigabeUmschalten(!istDemoVerfuegbar)}
              disabled={speichern.isPending}
              className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${
                istDemoVerfuegbar ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              title={istDemoVerfuegbar ? 'Demo deaktivieren' : 'Demo aktivieren'}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${
                  istDemoVerfuegbar ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {istDemoVerfuegbar && demoUrl && (
            <>
              <label className="text-xs font-medium ax-text-sekundaer mb-1 block mt-4">Demo-URL (oeffentlich)</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs ax-karte-erhoeht rounded-lg px-3 py-2 ax-text break-all select-all">
                  {demoUrl}
                </code>
                <button
                  onClick={demoLinkKopieren}
                  className="p-2 rounded-lg ax-hover ax-text-sekundaer transition-all flex-shrink-0"
                  title="Link kopieren"
                >
                  {demoKopiert ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg ax-hover ax-text-sekundaer transition-all flex-shrink-0"
                  title="In neuem Tab oeffnen"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              <p className="text-xs ax-text-tertiaer mt-2 leading-relaxed">
                Jeder mit dieser URL kann einen Anruf ausloesen. Rate-Limit: max. 3 Anrufe pro Stunde pro IP,
                1 Anruf pro 10 Minuten pro Telefonnummer. Damit die Demo funktioniert, muss <strong>VAPI aktiviert</strong>
                sein und Assistant + Phone-Number konfiguriert sein.
              </p>
            </>
          )}
          {!istDemoVerfuegbar && (
            <p className="text-xs ax-text-tertiaer mt-2 leading-relaxed">
              Aktiviere die Demo-Freigabe, um eine oeffentliche URL zu erhalten.
            </p>
          )}
        </div>
      )}

      {/* Formularfelder-Verwaltung */}
      {kampagne && (
        <div className="mb-5">
          <FelderVerwaltung
            kampagneId={id}
            felder={((kampagne as unknown as { felder?: KampagnenFeld[] }).felder) || []}
          />
        </div>
      )}

      <KanalKonfiguration
        werte={werte}
        onAendern={wertAendern}
        templates={templates}
        kundeId={kampagne?.kundeId ?? null}
      />

      <div className="mt-6">
        <button
          onClick={handleSpeichern}
          disabled={speichern.isPending}
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-6 py-2.5 rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
        >
          {speichern.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Einstellungen speichern
        </button>
      </div>
    </div>
  );
}

function FacebookFormAuswahl({ kundeId, aktuelleFormIds, kampagneId }: { kundeId: string; aktuelleFormIds: string[]; kampagneId: string }) {
  const { data: forms, isLoading } = benutzeFacebookForms(kundeId);
  const speichern = benutzeKampagneEinstellungenSpeichern();
  const { toastAnzeigen } = useToastStore();
  const [ausgewaehlt, setAusgewaehlt] = useState<string[]>(aktuelleFormIds);

  useEffect(() => { setAusgewaehlt(aktuelleFormIds); }, [aktuelleFormIds]);

  const formsSpeichern = async () => {
    try {
      await speichern.mutateAsync({
        id: kampagneId,
        triggerKonfiguration: { form_ids: ausgewaehlt },
      } as Record<string, unknown> & { id: string });
      toastAnzeigen('erfolg', 'Facebook-Formulare aktualisiert');
    } catch {
      toastAnzeigen('fehler', 'Fehler beim Speichern der Formulare');
    }
  };

  if (isLoading) return <div className="text-xs ax-text-tertiaer mt-3">Lade Facebook-Formulare...</div>;
  if (!forms?.length) return <div className="text-xs ax-text-tertiaer mt-3">Keine Facebook-Formulare gefunden.</div>;

  return (
    <div className="mt-3 space-y-2">
      <label className="text-xs font-medium ax-text-sekundaer">Facebook-Formulare</label>
      <div className="space-y-1.5">
        {forms.map((form) => {
          const istAktiv = ausgewaehlt.includes(form.id);
          return (
            <button
              key={form.id}
              type="button"
              onClick={() => setAusgewaehlt((prev) =>
                istAktiv ? prev.filter((id) => id !== form.id) : [...prev, form.id]
              )}
              className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-xs ${
                istAktiv
                  ? 'border-axano-orange bg-orange-50/50 dark:bg-orange-900/20'
                  : 'ax-rahmen border-[var(--rahmen)] ax-hover'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium ax-titel">{form.name}</span>
                <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                  istAktiv ? 'bg-axano-orange text-white' : 'border ax-rahmen-leicht'
                }`}>
                  {istAktiv && '✓'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {JSON.stringify(ausgewaehlt) !== JSON.stringify(aktuelleFormIds) && (
        <button
          onClick={formsSpeichern}
          disabled={speichern.isPending}
          className="bg-axano-orange hover:bg-orange-600 text-white font-medium px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
        >
          {speichern.isPending ? 'Speichern...' : 'Formulare aktualisieren'}
        </button>
      )}
    </div>
  );
}
