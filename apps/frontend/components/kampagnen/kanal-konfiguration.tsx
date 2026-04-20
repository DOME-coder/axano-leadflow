'use client';

import { Phone, Mail, MessageSquare, Calendar, Bell, Mic } from 'lucide-react';
import type { EmailTemplate } from '@/lib/typen';
import { benutzeWhatsappPhoneNumbers, benutzeWhatsappTemplates } from '@/hooks/benutze-kunden-integrationen';

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
  emailTemplateTerminBestaetigung: string;
  emailTemplateRueckruf: string;
  emailTemplateNichtInteressiert: string;
  whatsappAktiviert: boolean;
  whatsappAnbieter: 'superchat' | 'meta';
  whatsappKanalId: string;
  whatsappTemplateVerpasst: string;
  whatsappTemplateUnerreichbar: string;
  whatsappTemplateNichtInteressiert: string;
  // Meta-spezifisch
  whatsappMetaPhoneNumberId: string;
  whatsappTemplateVerpasstName: string;
  whatsappTemplateVerpasstSprache: string;
  whatsappTemplateUnerreichbarName: string;
  whatsappTemplateUnerreichbarSprache: string;
  whatsappTemplateNichtInteressiertName: string;
  whatsappTemplateNichtInteressiertSprache: string;
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
  kundeId?: string | null;
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

export function KanalKonfiguration({ werte, onAendern, templates, kundeId }: KanalKonfigurationProps) {
  const whatsappPhoneNumbers = benutzeWhatsappPhoneNumbers(kundeId || '');
  const whatsappTemplates = benutzeWhatsappTemplates(kundeId || '');
  const approvedTemplates = whatsappTemplates.data?.filter((t) => t.status === 'APPROVED') || [];

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
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe resize-y"
                rows={8}
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
                className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe resize-y"
                rows={4}
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
          <h3 className="font-semibold ax-titel text-sm">WhatsApp</h3>
        </div>

        <Toggle
          aktiv={werte.whatsappAktiviert}
          onToggle={() => onAendern('whatsappAktiviert', !werte.whatsappAktiviert)}
          bezeichnung="WhatsApp-Versand aktivieren"
        />

        {werte.whatsappAktiviert && (
          <div className="mt-4 space-y-4 pl-1">
            {/* Anbieter-Toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold ax-text-sekundaer uppercase tracking-wider">Anbieter</label>
              <div
                className="inline-flex items-center gap-1 p-1 rounded-xl w-full"
                style={{
                  backgroundColor: 'var(--karte-erhoeht)',
                  border: '1px solid var(--rahmen-leicht)',
                }}
              >
                <button
                  type="button"
                  onClick={() => onAendern('whatsappAnbieter', 'meta')}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={
                    werte.whatsappAnbieter === 'meta'
                      ? { backgroundColor: 'var(--karte)', color: 'var(--text-titel)', boxShadow: 'var(--schatten-sm)' }
                      : { color: 'var(--text-sekundaer)' }
                  }
                >
                  Meta WhatsApp (empfohlen)
                </button>
                <button
                  type="button"
                  onClick={() => onAendern('whatsappAnbieter', 'superchat')}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={
                    werte.whatsappAnbieter !== 'meta'
                      ? { backgroundColor: 'var(--karte)', color: 'var(--text-titel)', boxShadow: 'var(--schatten-sm)' }
                      : { color: 'var(--text-sekundaer)' }
                  }
                >
                  Superchat
                </button>
              </div>
            </div>

            {werte.whatsappAnbieter === 'meta' ? (
              <>
                {/* Phone Number Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-medium ax-text">Telefonnummer *</label>
                  {!kundeId ? (
                    <p className="text-xs ax-text-tertiaer">Bitte zuerst Kunde auswählen.</p>
                  ) : whatsappPhoneNumbers.isLoading ? (
                    <p className="text-xs ax-text-tertiaer">Lade Telefonnummern…</p>
                  ) : !whatsappPhoneNumbers.data || whatsappPhoneNumbers.data.length === 0 ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs">
                      <p className="text-amber-800 dark:text-amber-300 font-medium mb-1">
                        Keine Telefonnummern gefunden
                      </p>
                      <p className="ax-text-sekundaer">
                        Der Kunde muss WhatsApp verbinden und eine Nummer in Meta verifizieren.{' '}
                        <a href={`/kunden/${kundeId}`} className="text-axano-orange hover:underline">
                          Zur Kunden-Integration →
                        </a>
                      </p>
                    </div>
                  ) : (
                    <select
                      value={werte.whatsappMetaPhoneNumberId}
                      onChange={(e) => onAendern('whatsappMetaPhoneNumberId', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                    >
                      <option value="">Nummer wählen…</option>
                      {whatsappPhoneNumbers.data.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.displayPhoneNumber} · {n.verifiedName}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Template-Dropdowns */}
                <div className="space-y-3">
                  {approvedTemplates.length === 0 && kundeId && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs leading-relaxed">
                      <p className="font-medium text-blue-800 dark:text-blue-300 mb-1">
                        Keine genehmigten Templates
                      </p>
                      <p className="ax-text-sekundaer">
                        Templates müssen in Meta Business Manager eingereicht und vor Nutzung von Meta
                        genehmigt werden (ca. 24 h). Status-Prüfung über{' '}
                        <a href={`/kunden/${kundeId}`} className="text-axano-orange hover:underline">
                          Verbindung testen →
                        </a>
                      </p>
                    </div>
                  )}
                  {[
                    { name: 'verpasst', bezeichnung: 'Template: Verpasst' },
                    { name: 'unerreichbar', bezeichnung: 'Template: Nicht erreichbar' },
                    { name: 'nichtInteressiert', bezeichnung: 'Template: Nicht interessiert' },
                  ].map(({ name, bezeichnung }) => {
                    const schluesselName = `whatsappTemplate${name.charAt(0).toUpperCase()}${name.slice(1)}Name` as keyof KanalKonfigurationWerte;
                    const schluesselSprache = `whatsappTemplate${name.charAt(0).toUpperCase()}${name.slice(1)}Sprache` as keyof KanalKonfigurationWerte;
                    const aktuellName = werte[schluesselName] as string;
                    const aktuellSprache = werte[schluesselSprache] as string;
                    return (
                      <div key={name} className="grid grid-cols-[1fr_auto] gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-medium ax-text">{bezeichnung}</label>
                          <select
                            value={aktuellName || ''}
                            onChange={(e) => {
                              const template = approvedTemplates.find((t) => t.name === e.target.value);
                              onAendern(schluesselName, e.target.value);
                              if (template) onAendern(schluesselSprache, template.language);
                            }}
                            disabled={approvedTemplates.length === 0}
                            className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe disabled:opacity-50"
                          >
                            <option value="">Template wählen…</option>
                            {approvedTemplates.map((t) => (
                              <option key={t.id} value={t.name}>
                                {t.name} · {t.language}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium ax-text">Sprache</label>
                          <input
                            value={aktuellSprache || 'de'}
                            onChange={(e) => onAendern(schluesselSprache, e.target.value)}
                            className="w-20 px-3 py-2.5 text-sm rounded-lg ax-eingabe tabular-nums"
                            placeholder="de"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                {/* Superchat-Felder (bestehend) */}
                <div className="space-y-1">
                  <label className="text-xs font-medium ax-text">Kanal-ID *</label>
                  <input
                    value={werte.whatsappKanalId}
                    onChange={(e) => onAendern('whatsappKanalId', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
                    placeholder="mc_xxx"
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium ax-text">Template: Verpasst</label>
                    <textarea
                      value={werte.whatsappTemplateVerpasst}
                      onChange={(e) => onAendern('whatsappTemplateVerpasst', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe resize-y"
                      rows={3}
                      placeholder="Hallo {{vorname}}, wir haben versucht dich zu erreichen..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium ax-text">Template: Nicht erreichbar</label>
                    <textarea
                      value={werte.whatsappTemplateUnerreichbar}
                      onChange={(e) => onAendern('whatsappTemplateUnerreichbar', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe resize-y"
                      rows={3}
                      placeholder="Hallo {{vorname}}, leider konnten wir dich bisher nicht erreichen..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium ax-text">Template: Nicht interessiert</label>
                    <textarea
                      value={werte.whatsappTemplateNichtInteressiert}
                      onChange={(e) => onAendern('whatsappTemplateNichtInteressiert', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe resize-y"
                      rows={3}
                      placeholder="Hallo {{vorname}}, vielen Dank für dein ehrliches Feedback..."
                    />
                  </div>
                </div>
              </>
            )}
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
