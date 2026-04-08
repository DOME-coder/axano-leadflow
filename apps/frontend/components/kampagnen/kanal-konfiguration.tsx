'use client';

import { Phone, Mail, MessageSquare, Calendar, Bell, Mic } from 'lucide-react';
import type { EmailTemplate } from '@/lib/typen';

export interface KanalKonfigurationWerte {
  vapiAktiviert: boolean;
  vapiAssistantId: string;
  vapiPhoneNumberId: string;
  vapiPrompt: string;
  vapiErsteBotschaft: string;
  vapiVoicemailNachricht: string;
  maxAnrufVersuche: number;
  emailAktiviert: boolean;
  emailTemplateVerpasst: string;
  emailTemplateVoicemail: string;
  emailTemplateUnerreichbar: string;
  whatsappAktiviert: boolean;
  whatsappKanalId: string;
  whatsappTemplateVerpasst: string;
  whatsappTemplateUnerreichbar: string;
  whatsappTemplateNichtInteressiert: string;
  kiName: string;
  kiGeschlecht: string;
  kiSprachstil: string;
  benachrichtigungEmail: string;
  calendlyLink: string;
}

interface KanalKonfigurationProps {
  werte: KanalKonfigurationWerte;
  onAendern: (schluessel: keyof KanalKonfigurationWerte, wert: unknown) => void;
  templates?: EmailTemplate[];
}

function Toggle({ aktiv, onToggle, bezeichnung }: { aktiv: boolean; onToggle: () => void; bezeichnung: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-3 w-full"
    >
      <div className={`relative w-10 h-5 rounded-full transition-colors ${aktiv ? 'bg-axano-orange' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${aktiv ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm font-medium ax-text">{bezeichnung}</span>
    </button>
  );
}

export function KanalKonfiguration({ werte, onAendern, templates }: KanalKonfigurationProps) {
  return (
    <div className="space-y-4">
      {/* VAPI KI-Telefonate */}
      <div className="ax-karte rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Phone className="w-4 h-4 ax-text" />
          <h3 className="font-semibold ax-titel text-sm">VAPI KI-Telefonate</h3>
        </div>

        <Toggle
          aktiv={werte.vapiAktiviert}
          onToggle={() => onAendern('vapiAktiviert', !werte.vapiAktiviert)}
          bezeichnung="KI-Anrufe aktivieren"
        />

        {werte.vapiAktiviert && (
          <div className="mt-4 space-y-3 pl-1">
            <div className="text-xs ax-text-sekundaer bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <strong>Tipp:</strong> Lass die Felder leer, um die VAPI-Daten aus der
              Kunden-Integration zu nutzen (Kunde&nbsp;→&nbsp;Integrationen&nbsp;→&nbsp;VAPI).
              So kann jeder Kunde seinen eigenen VAPI-Assistenten und seine eigene
              Telefonnummer verwenden. Werte hier überschreiben die Kunden-Integration nur
              für diese eine Kampagne.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">Assistant ID (optional)</label>
                <input
                  value={werte.vapiAssistantId}
                  onChange={(e) => onAendern('vapiAssistantId', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                  placeholder="aus Kunden-Integration oder asst_xxx"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">Telefonnummer-ID (optional)</label>
                <input
                  value={werte.vapiPhoneNumberId}
                  onChange={(e) => onAendern('vapiPhoneNumberId', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                  placeholder="aus Kunden-Integration oder phone_xxx"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">VAPI Prompt (optional)</label>
              <textarea
                value={werte.vapiPrompt}
                onChange={(e) => onAendern('vapiPrompt', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe resize-none"
                rows={3}
                placeholder="Leer lassen für Standard-Prompt"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Erste Begrüßungsnachricht</label>
              <input
                value={werte.vapiErsteBotschaft}
                onChange={(e) => onAendern('vapiErsteBotschaft', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                placeholder="Hallo, hier ist [Name]. Spreche ich mit {{vorname}} {{nachname}}?"
              />
              <p className="text-xs ax-text-tertiaer">Platzhalter: {'{{vorname}}'}, {'{{nachname}}'}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Voicemail-Nachricht</label>
              <textarea
                value={werte.vapiVoicemailNachricht}
                onChange={(e) => onAendern('vapiVoicemailNachricht', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe resize-none"
                rows={2}
                placeholder="Nachricht die auf der Mailbox hinterlassen wird"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Max. Anrufversuche</label>
              <input
                type="number"
                value={werte.maxAnrufVersuche}
                onChange={(e) => onAendern('maxAnrufVersuche', Math.min(20, Math.max(1, parseInt(e.target.value) || 11)))}
                className="w-32 px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                min={1} max={20}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stimme & Stil (nur wenn VAPI aktiv) */}
      {werte.vapiAktiviert && (
        <div className="ax-karte rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="w-4 h-4 ax-text" />
            <h3 className="font-semibold ax-titel text-sm">Stimme & Stil</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">KI-Name</label>
              <input
                value={werte.kiName}
                onChange={(e) => onAendern('kiName', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                placeholder="z.B. Giuseppa, Max, Sophie"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Geschlecht</label>
              <select
                value={werte.kiGeschlecht}
                onChange={(e) => onAendern('kiGeschlecht', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              >
                <option value="">Nicht festgelegt</option>
                <option value="weiblich">Weiblich</option>
                <option value="maennlich">Männlich</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Sprachstil</label>
              <select
                value={werte.kiSprachstil}
                onChange={(e) => onAendern('kiSprachstil', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              >
                <option value="freundlich">Freundlich</option>
                <option value="formell">Formell</option>
                <option value="direkt">Direkt</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* E-Mail Follow-up */}
      <div className="ax-karte rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mail className="w-4 h-4 ax-text" />
          <h3 className="font-semibold ax-titel text-sm">E-Mail Follow-up</h3>
        </div>

        <Toggle
          aktiv={werte.emailAktiviert}
          onToggle={() => onAendern('emailAktiviert', !werte.emailAktiviert)}
          bezeichnung="E-Mail-Versand aktivieren"
        />

        {werte.emailAktiviert && (
          <div className="mt-4 space-y-3 pl-1">
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Template: Verpasster Anruf</label>
              <select
                value={werte.emailTemplateVerpasst}
                onChange={(e) => onAendern('emailTemplateVerpasst', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              >
                <option value="">Kein Template</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Template: Voicemail</label>
              <select
                value={werte.emailTemplateVoicemail}
                onChange={(e) => onAendern('emailTemplateVoicemail', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              >
                <option value="">Kein Template</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Template: Nicht erreichbar</label>
              <select
                value={werte.emailTemplateUnerreichbar}
                onChange={(e) => onAendern('emailTemplateUnerreichbar', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              >
                <option value="">Kein Template</option>
                {templates?.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="ax-karte rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-4 h-4 ax-text" />
          <h3 className="font-semibold ax-titel text-sm">WhatsApp (Superchat)</h3>
        </div>

        <Toggle
          aktiv={werte.whatsappAktiviert}
          onToggle={() => onAendern('whatsappAktiviert', !werte.whatsappAktiviert)}
          bezeichnung="WhatsApp-Versand aktivieren"
        />

        {werte.whatsappAktiviert && (
          <div className="mt-4 space-y-3 pl-1">
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Kanal-ID *</label>
              <input
                value={werte.whatsappKanalId}
                onChange={(e) => onAendern('whatsappKanalId', e.target.value)}
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                placeholder="mc_xxx"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">Template: Verpasst</label>
                <input
                  value={werte.whatsappTemplateVerpasst}
                  onChange={(e) => onAendern('whatsappTemplateVerpasst', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                  placeholder="tn_xxx"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">Template: Nicht erreichbar</label>
                <input
                  value={werte.whatsappTemplateUnerreichbar}
                  onChange={(e) => onAendern('whatsappTemplateUnerreichbar', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                  placeholder="tn_xxx"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium ax-text">Template: Nicht interessiert</label>
                <input
                  value={werte.whatsappTemplateNichtInteressiert}
                  onChange={(e) => onAendern('whatsappTemplateNichtInteressiert', e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                  placeholder="tn_xxx"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sonstiges */}
      <div className="ax-karte rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-4 h-4 ax-text" />
          <h3 className="font-semibold ax-titel text-sm">Sonstiges</h3>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium ax-text">Benachrichtigungs-E-Mail</label>
            <input
              type="email"
              value={werte.benachrichtigungEmail}
              onChange={(e) => onAendern('benachrichtigungEmail', e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              placeholder="team@firma.de"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium ax-text flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Calendly-Link
            </label>
            <input
              type="url"
              value={werte.calendlyLink}
              onChange={(e) => onAendern('calendlyLink', e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              placeholder="https://calendly.com/..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
