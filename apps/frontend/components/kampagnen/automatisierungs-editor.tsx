'use client';

import { useState } from 'react';
import { X, Plus, Trash2, ArrowDown } from 'lucide-react';
import { benutzeAutomatisierungErstellen } from '@/hooks/benutze-automatisierungen';
import { useToastStore } from '@/stores/toast-store';

interface EditorProps {
  kampagneId: string;
  onSchliessen: () => void;
}

const triggerOptionen = [
  { wert: 'lead_eingetroffen', bezeichnung: 'Lead eingetroffen', beschreibung: 'Wenn ein neuer Lead erstellt wird' },
  { wert: 'status_geaendert', bezeichnung: 'Status geändert', beschreibung: 'Wenn der Lead-Status sich ändert' },
  { wert: 'inaktivitaet', bezeichnung: 'Inaktivität (X Tage)', beschreibung: 'Wenn ein Lead X Tage inaktiv ist' },
  { wert: 'zeitplan', bezeichnung: 'Zeitplan', beschreibung: 'Zu festgelegten Zeiten ausführen' },
];

const aktionOptionen = [
  { wert: 'email_senden', bezeichnung: 'E-Mail senden' },
  { wert: 'status_setzen', bezeichnung: 'Status setzen' },
  { wert: 'warten', bezeichnung: 'Warten (Minuten)' },
  { wert: 'warten_bis_uhrzeit', bezeichnung: 'Warten bis Uhrzeit' },
  { wert: 'whatsapp_senden', bezeichnung: 'WhatsApp senden' },
  { wert: 'benachrichtigung', bezeichnung: 'Benachrichtigung' },
];

interface SchrittDaten {
  aktionTyp: string;
  konfiguration: Record<string, unknown>;
}

const wochentagOptionen = [
  { wert: 1, bezeichnung: 'Mo' },
  { wert: 2, bezeichnung: 'Di' },
  { wert: 3, bezeichnung: 'Mi' },
  { wert: 4, bezeichnung: 'Do' },
  { wert: 5, bezeichnung: 'Fr' },
  { wert: 6, bezeichnung: 'Sa' },
  { wert: 0, bezeichnung: 'So' },
];

export function AutomatisierungsEditor({ kampagneId, onSchliessen }: EditorProps) {
  const erstellen = benutzeAutomatisierungErstellen();
  const { toastAnzeigen } = useToastStore();
  const [name, setName] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [triggerTyp, setTriggerTyp] = useState('lead_eingetroffen');
  const [triggerKonfiguration, setTriggerKonfiguration] = useState<Record<string, unknown>>({});
  const [schritte, setSchritte] = useState<SchrittDaten[]>([]);
  const [fehler, setFehler] = useState('');

  const schrittHinzufuegen = () => {
    setSchritte([...schritte, { aktionTyp: 'email_senden', konfiguration: {} }]);
  };

  const schrittAktualisieren = (index: number, daten: Partial<SchrittDaten>) => {
    const aktualisiert = [...schritte];
    aktualisiert[index] = { ...aktualisiert[index], ...daten };
    setSchritte(aktualisiert);
  };

  const schrittEntfernen = (index: number) => {
    setSchritte(schritte.filter((_, i) => i !== index));
  };

  const absenden = async () => {
    setFehler('');
    if (!name.trim()) {
      setFehler('Name ist erforderlich');
      return;
    }
    if (schritte.length === 0) {
      setFehler('Mindestens ein Schritt ist erforderlich');
      return;
    }

    try {
      await erstellen.mutateAsync({
        kampagneId,
        name: name.trim(),
        beschreibung: beschreibung.trim() || undefined,
        triggerTyp,
        triggerKonfiguration,
        schritte: schritte.map((s, i) => ({
          reihenfolge: i,
          aktionTyp: s.aktionTyp,
          konfiguration: s.konfiguration,
        })),
      });
      toastAnzeigen('erfolg', 'Automatisierung erstellt');
      onSchliessen();
    } catch {
      setFehler('Fehler beim Erstellen der Automatisierung');
      toastAnzeigen('fehler', 'Fehler beim Erstellen der Automatisierung');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onSchliessen} />

      <div className="relative ax-karte rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-y-auto m-4">
        <div className="sticky top-0 ax-karte border-b ax-rahmen-leicht px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="font-bold ax-titel">Neue Automatisierung</h2>
          <button onClick={onSchliessen} className="p-1.5 rounded-lg ax-text-tertiaer ax-hover transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {fehler && (
            <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 text-sm rounded-lg p-3">
              {fehler}
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              placeholder="z.B. Follow-up E-Mail bei Nicht erreichbar"
            />
          </div>

          {/* Beschreibung */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">Beschreibung</label>
            <input
              type="text"
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              placeholder="Optionale Beschreibung"
            />
          </div>

          {/* Trigger */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">Trigger</label>
            <select
              value={triggerTyp}
              onChange={(e) => { setTriggerTyp(e.target.value); setTriggerKonfiguration({}); }}
              className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
            >
              {triggerOptionen.map((t) => (
                <option key={t.wert} value={t.wert}>{t.bezeichnung} – {t.beschreibung}</option>
              ))}
            </select>
          </div>

          {/* Trigger-Konfiguration für status_geaendert */}
          {triggerTyp === 'status_geaendert' && (
            <div className="ax-karte-erhoeht rounded-lg p-3 space-y-2">
              <label className="text-xs font-medium ax-text">Zu Status</label>
              <select
                value={(triggerKonfiguration.zuStatus as string) || ''}
                onChange={(e) => setTriggerKonfiguration({ ...triggerKonfiguration, zuStatus: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
              >
                <option value="">Beliebig</option>
                <option value="In Bearbeitung">In Bearbeitung</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Nicht erreichbar">Nicht erreichbar</option>
                <option value="Termin gebucht">Termin gebucht</option>
                <option value="Nicht interessiert">Nicht interessiert</option>
              </select>
            </div>
          )}

          {/* Trigger-Konfiguration für inaktivitaet */}
          {triggerTyp === 'inaktivitaet' && (
            <div className="ax-karte-erhoeht rounded-lg p-3 space-y-2">
              <label className="text-xs font-medium ax-text">Tage ohne Aktivität</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={(triggerKonfiguration.tage as number) || 3}
                  onChange={(e) => setTriggerKonfiguration({ ...triggerKonfiguration, tage: parseInt(e.target.value) || 3 })}
                  className="w-24 px-3 py-2 text-sm rounded-lg ax-eingabe"
                  min={1}
                />
                <span className="text-sm ax-text-sekundaer">Tage</span>
              </div>
            </div>
          )}

          {/* Trigger-Konfiguration für zeitplan */}
          {triggerTyp === 'zeitplan' && (
            <div className="ax-karte-erhoeht rounded-lg p-3 space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium ax-text">Wochentage</label>
                <div className="flex flex-wrap gap-2">
                  {wochentagOptionen.map((tag) => {
                    const aktuelleWochentage = (triggerKonfiguration.wochentage as number[]) || [1, 2, 3, 4, 5];
                    const ausgewaehlt = aktuelleWochentage.includes(tag.wert);
                    return (
                      <label key={tag.wert} className="flex items-center gap-1.5 text-xs ax-text cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ausgewaehlt}
                          onChange={(e) => {
                            const neueWochentage = e.target.checked
                              ? [...aktuelleWochentage, tag.wert]
                              : aktuelleWochentage.filter((w) => w !== tag.wert);
                            setTriggerKonfiguration({ ...triggerKonfiguration, wochentage: neueWochentage });
                          }}
                          className="rounded border-axano-sky-blue"
                        />
                        {tag.bezeichnung}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium ax-text">Uhrzeit</label>
                <input
                  type="time"
                  value={(triggerKonfiguration.uhrzeit as string) || '09:00'}
                  onChange={(e) => setTriggerKonfiguration({ ...triggerKonfiguration, uhrzeit: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                />
              </div>
            </div>
          )}

          {/* Schritte */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">Schritte</label>

            {schritte.map((schritt, index) => (
              <div key={index}>
                {index > 0 && (
                  <div className="flex justify-center py-1">
                    <ArrowDown className="w-4 h-4 ax-text-tertiaer" />
                  </div>
                )}
                <div className="ax-karte-erhoeht rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold ax-text-sekundaer">Schritt {index + 1}</span>
                    <button onClick={() => schrittEntfernen(index)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <select
                    value={schritt.aktionTyp}
                    onChange={(e) => schrittAktualisieren(index, { aktionTyp: e.target.value, konfiguration: {} })}
                    className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                  >
                    {aktionOptionen.map((a) => (
                      <option key={a.wert} value={a.wert}>{a.bezeichnung}</option>
                    ))}
                  </select>

                  {/* Konfiguration je nach Typ */}
                  {schritt.aktionTyp === 'status_setzen' && (
                    <select
                      value={(schritt.konfiguration.neuerStatus as string) || ''}
                      onChange={(e) => schrittAktualisieren(index, { konfiguration: { neuerStatus: e.target.value } })}
                      className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                    >
                      <option value="">Status wählen...</option>
                      <option value="In Bearbeitung">In Bearbeitung</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Nicht erreichbar">Nicht erreichbar</option>
                      <option value="Termin gebucht">Termin gebucht</option>
                      <option value="Nicht interessiert">Nicht interessiert</option>
                    </select>
                  )}

                  {schritt.aktionTyp === 'warten' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={(schritt.konfiguration.minuten as number) || 30}
                        onChange={(e) => schrittAktualisieren(index, { konfiguration: { minuten: parseInt(e.target.value) || 30 } })}
                        className="w-24 px-3 py-2 text-sm rounded-lg ax-eingabe"
                        min={1}
                      />
                      <span className="text-sm ax-text-sekundaer">Minuten</span>
                    </div>
                  )}

                  {schritt.aktionTyp === 'warten_bis_uhrzeit' && (
                    <input
                      type="time"
                      value={(schritt.konfiguration.uhrzeit as string) || '09:00'}
                      onChange={(e) => schrittAktualisieren(index, { konfiguration: { uhrzeit: e.target.value, wochentage: [1, 2, 3, 4, 5] } })}
                      className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                    />
                  )}

                  {schritt.aktionTyp === 'email_senden' && (
                    <input
                      type="text"
                      value={(schritt.konfiguration.templateId as string) || ''}
                      onChange={(e) => schrittAktualisieren(index, { konfiguration: { ...schritt.konfiguration, templateId: e.target.value } })}
                      className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                      placeholder="Template-ID (aus Template-Verwaltung)"
                    />
                  )}

                  {schritt.aktionTyp === 'whatsapp_senden' && (
                    <input
                      type="text"
                      value={(schritt.konfiguration.whatsappTemplateId as string) || ''}
                      onChange={(e) => schrittAktualisieren(index, { konfiguration: { ...schritt.konfiguration, whatsappTemplateId: e.target.value } })}
                      className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                      placeholder="WhatsApp Template-ID"
                    />
                  )}

                  {schritt.aktionTyp === 'benachrichtigung' && (
                    <input
                      type="email"
                      value={(schritt.konfiguration.email as string) || ''}
                      onChange={(e) => schrittAktualisieren(index, { konfiguration: { ...schritt.konfiguration, email: e.target.value } })}
                      className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
                      placeholder="Benachrichtigungs-E-Mail-Adresse"
                    />
                  )}
                </div>
              </div>
            ))}

            <button
              onClick={schrittHinzufuegen}
              className="w-full border-2 border-dashed ax-rahmen border-[var(--rahmen)] ax-text-sekundaer hover:border-axano-orange hover:text-axano-orange rounded-lg py-3 text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4 inline mr-1" />
              Schritt hinzufügen
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 ax-karte border-t ax-rahmen-leicht px-6 py-4 flex justify-end gap-3 rounded-b-xl">
          <button
            onClick={onSchliessen}
            className="border ax-rahmen-leicht ax-text font-medium px-5 py-2.5 rounded-lg transition-all text-sm ax-hover"
          >
            Abbrechen
          </button>
          <button
            onClick={absenden}
            disabled={erstellen.isPending}
            className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm disabled:opacity-50 flex items-center gap-2"
          >
            {erstellen.isPending && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Erstellen
          </button>
        </div>
      </div>
    </div>
  );
}
