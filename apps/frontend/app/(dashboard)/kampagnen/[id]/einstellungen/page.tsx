'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Copy, Check } from 'lucide-react';
import { benutzeKampagne } from '@/hooks/benutze-kampagnen';
import { benutzeKampagneEinstellungenSpeichern } from '@/hooks/benutze-kampagne-einstellungen';
import { benutzeTemplates } from '@/hooks/benutze-templates';
import { KanalKonfiguration, type KanalKonfigurationWerte } from '@/components/kampagnen/kanal-konfiguration';
import { useToastStore } from '@/stores/toast-store';

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

export default function KampagneEinstellungenSeite({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: kampagne } = benutzeKampagne(id);
  const { data: templates } = benutzeTemplates();
  const speichern = benutzeKampagneEinstellungenSpeichern();

  const { toastAnzeigen } = useToastStore();
  const [werte, setWerte] = useState<KanalKonfigurationWerte>(standardWerte);
  const [kopiert, setKopiert] = useState(false);

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
        whatsappKanalId: kampagne.whatsappKanalId ?? '',
        whatsappTemplateVerpasst: kampagne.whatsappTemplateVerpasst ?? '',
        whatsappTemplateUnerreichbar: kampagne.whatsappTemplateUnerreichbar ?? '',
        whatsappTemplateNichtInteressiert: kampagne.whatsappTemplateNichtInteressiert ?? '',
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
        whatsappKanalId: werte.whatsappKanalId || null,
        whatsappTemplateVerpasst: werte.whatsappTemplateVerpasst || null,
        whatsappTemplateUnerreichbar: werte.whatsappTemplateUnerreichbar || null,
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
            <span className="text-xs ax-text-tertiaer">Kann nach Erstellung nicht geaendert werden</span>
          </div>
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

      <KanalKonfiguration
        werte={werte}
        onAendern={wertAendern}
        templates={templates}
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
