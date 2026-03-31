'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { benutzeKampagne } from '@/hooks/benutze-kampagnen';
import { benutzeKampagneEinstellungenSpeichern } from '@/hooks/benutze-kampagne-einstellungen';
import { benutzeTemplates } from '@/hooks/benutze-templates';
import { KanalKonfiguration, type KanalKonfigurationWerte } from '@/components/kampagnen/kanal-konfiguration';

const standardWerte: KanalKonfigurationWerte = {
  vapiAktiviert: false,
  vapiAssistantId: '',
  vapiPhoneNumberId: '',
  vapiPrompt: '',
  maxAnrufVersuche: 11,
  emailAktiviert: true,
  emailTemplateVerpasst: '',
  emailTemplateVoicemail: '',
  emailTemplateUnerreichbar: '',
  whatsappAktiviert: false,
  whatsappKanalId: '',
  whatsappTemplateVerpasst: '',
  whatsappTemplateUnerreichbar: '',
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

  const [werte, setWerte] = useState<KanalKonfigurationWerte>(standardWerte);
  const [erfolg, setErfolg] = useState('');

  useEffect(() => {
    if (kampagne) {
      setWerte({
        vapiAktiviert: kampagne.vapiAktiviert ?? false,
        vapiAssistantId: kampagne.vapiAssistantId ?? '',
        vapiPhoneNumberId: kampagne.vapiPhoneNumberId ?? '',
        vapiPrompt: kampagne.vapiPrompt ?? '',
        maxAnrufVersuche: kampagne.maxAnrufVersuche ?? 11,
        emailAktiviert: kampagne.emailAktiviert ?? true,
        emailTemplateVerpasst: kampagne.emailTemplateVerpasst ?? '',
        emailTemplateVoicemail: kampagne.emailTemplateVoicemail ?? '',
        emailTemplateUnerreichbar: kampagne.emailTemplateUnerreichbar ?? '',
        whatsappAktiviert: kampagne.whatsappAktiviert ?? false,
        whatsappKanalId: kampagne.whatsappKanalId ?? '',
        whatsappTemplateVerpasst: kampagne.whatsappTemplateVerpasst ?? '',
        whatsappTemplateUnerreichbar: kampagne.whatsappTemplateUnerreichbar ?? '',
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

  const handleSpeichern = async () => {
    setErfolg('');
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
    setErfolg('Einstellungen gespeichert');
    setTimeout(() => setErfolg(''), 3000);
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

      {erfolg && (
        <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded-lg p-3 mb-4">
          {erfolg}
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
