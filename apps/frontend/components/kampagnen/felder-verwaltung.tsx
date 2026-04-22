'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, X, Save, ListChecks } from 'lucide-react';
import {
  benutzeFeldAktualisieren,
  benutzeFeldHinzufuegen,
  benutzeFeldLoeschen,
  type FeldEingabe,
  type KampagnenFeld,
} from '@/hooks/benutze-kampagnen-felder';
import { useToastStore } from '@/stores/toast-store';

const FELDTYP_LABEL: Record<KampagnenFeld['feldtyp'], string> = {
  text: 'Text',
  zahl: 'Zahl',
  email: 'E-Mail',
  telefon: 'Telefon',
  datum: 'Datum',
  auswahl: 'Auswahl',
  ja_nein: 'Ja/Nein',
  mehrzeilig: 'Mehrzeilig',
};

export function FelderVerwaltung({ kampagneId, felder }: { kampagneId: string; felder: KampagnenFeld[] }) {
  const hinzufuegen = benutzeFeldHinzufuegen(kampagneId);
  const aktualisieren = benutzeFeldAktualisieren(kampagneId);
  const loeschen = benutzeFeldLoeschen(kampagneId);
  const { toastAnzeigen } = useToastStore();

  const [bearbeiten, setBearbeiten] = useState<KampagnenFeld | null>(null);
  const [neuOffen, setNeuOffen] = useState(false);
  const [loeschBestaetigung, setLoeschBestaetigung] = useState<KampagnenFeld | null>(null);

  const feldSpeichern = async (feldId: string | null, daten: FeldEingabe) => {
    try {
      if (feldId) {
        await aktualisieren.mutateAsync({ feldId, daten });
        toastAnzeigen('erfolg', 'Feld aktualisiert');
      } else {
        await hinzufuegen.mutateAsync(daten);
        toastAnzeigen('erfolg', 'Feld hinzugefuegt');
      }
      setBearbeiten(null);
      setNeuOffen(false);
    } catch {
      toastAnzeigen('fehler', 'Speichern fehlgeschlagen');
    }
  };

  const feldLoeschen = async () => {
    if (!loeschBestaetigung) return;
    try {
      await loeschen.mutateAsync(loeschBestaetigung.id);
      toastAnzeigen('erfolg', 'Feld geloescht');
      setLoeschBestaetigung(null);
    } catch {
      toastAnzeigen('fehler', 'Loeschen fehlgeschlagen');
    }
  };

  return (
    <div className="ax-karte rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-axano-orange/10 flex items-center justify-center flex-shrink-0">
            <ListChecks className="w-4 h-4 text-axano-orange" strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-sm font-semibold ax-titel">Formularfelder</h3>
            <p className="text-xs ax-text-sekundaer mt-0.5">
              Felder, die im Demo-Formular abgefragt und im Anruf von der KI bestaetigt werden.
              Standardfelder (Name, E-Mail, Telefon) werden automatisch erfasst und hier nicht aufgelistet.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setBearbeiten(null);
            setNeuOffen(true);
          }}
          className="flex items-center gap-1 text-xs bg-axano-orange hover:bg-orange-600 text-white font-semibold px-3 py-2 rounded-lg transition-all flex-shrink-0"
        >
          <Plus className="w-3 h-3" strokeWidth={2.2} />
          Feld hinzufuegen
        </button>
      </div>

      {felder.length === 0 && !neuOffen && (
        <p className="text-xs ax-text-tertiaer text-center py-6">
          Noch keine Felder definiert. Fuege deiner Kampagne Felder hinzu, die die KI im Anruf abfragen soll.
        </p>
      )}

      <div className="space-y-2">
        {felder.map((feld) => (
          <div key={feld.id}>
            {bearbeiten?.id === feld.id ? (
              <FeldFormular
                initial={feld}
                onSpeichern={(daten) => feldSpeichern(feld.id, daten)}
                onAbbrechen={() => setBearbeiten(null)}
                speichern={aktualisieren.isPending}
              />
            ) : (
              <div className="flex items-center justify-between gap-2 border ax-rahmen-leicht rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm ax-titel truncate">{feld.bezeichnung}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {FELDTYP_LABEL[feld.feldtyp]}
                    </span>
                    {feld.pflichtfeld && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                        Pflicht
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      setNeuOffen(false);
                      setBearbeiten(feld);
                    }}
                    className="p-1.5 rounded ax-hover ax-text-sekundaer"
                    title="Bearbeiten"
                  >
                    <Pencil className="w-3.5 h-3.5" strokeWidth={2.2} />
                  </button>
                  <button
                    onClick={() => setLoeschBestaetigung(feld)}
                    className="p-1.5 rounded ax-hover text-red-500 hover:text-red-700"
                    title="Loeschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {neuOffen && (
        <div className="mt-3">
          <FeldFormular
            onSpeichern={(daten) => feldSpeichern(null, daten)}
            onAbbrechen={() => setNeuOffen(false)}
            speichern={hinzufuegen.isPending}
          />
        </div>
      )}

      {loeschBestaetigung && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setLoeschBestaetigung(null)} />
          <div className="relative ax-karte rounded-xl shadow-xl w-full max-w-md m-4 p-6">
            <h2 className="font-bold ax-titel mb-2">Feld endgueltig loeschen?</h2>
            <p className="text-sm ax-text-sekundaer">
              <strong>{loeschBestaetigung.bezeichnung}</strong> wird aus der Kampagne entfernt.
              Bereits erfasste Lead-Antworten zu diesem Feld werden ebenfalls geloescht.
            </p>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setLoeschBestaetigung(null)}
                className="border ax-rahmen-leicht ax-text px-4 py-2 rounded-lg text-sm"
              >
                Abbrechen
              </button>
              <button
                onClick={feldLoeschen}
                disabled={loeschen.isPending}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Endgueltig loeschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FeldFormular({
  initial,
  onSpeichern,
  onAbbrechen,
  speichern,
}: {
  initial?: KampagnenFeld;
  onSpeichern: (daten: FeldEingabe) => void;
  onAbbrechen: () => void;
  speichern: boolean;
}) {
  const [bezeichnung, setBezeichnung] = useState(initial?.bezeichnung || '');
  const [feldtyp, setFeldtyp] = useState<KampagnenFeld['feldtyp']>(initial?.feldtyp || 'text');
  const [pflichtfeld, setPflichtfeld] = useState(initial?.pflichtfeld ?? true);
  const [optionen, setOptionen] = useState<string>(initial?.optionen?.join(', ') || '');
  const [platzhalter, setPlatzhalter] = useState(initial?.platzhalter || '');

  const absenden = () => {
    if (!bezeichnung.trim()) return;
    const daten: FeldEingabe = {
      bezeichnung: bezeichnung.trim(),
      feldtyp,
      pflichtfeld,
      platzhalter: platzhalter.trim() || undefined,
    };
    if (feldtyp === 'auswahl' && optionen.trim()) {
      daten.optionen = optionen.split(',').map((s) => s.trim()).filter(Boolean);
    }
    onSpeichern(daten);
  };

  return (
    <div className="border-2 border-axano-orange/40 rounded-lg p-4 space-y-3 ax-karte-erhoeht">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold ax-titel uppercase tracking-wide">
          {initial ? 'Feld bearbeiten' : 'Neues Feld'}
        </h4>
        <button onClick={onAbbrechen} className="p-1 ax-text-tertiaer hover:ax-text">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium ax-text">Bezeichnung (Frage, wie sie gestellt wird)</label>
        <input
          type="text"
          value={bezeichnung}
          onChange={(e) => setBezeichnung(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
          placeholder="z.B. Haben Sie bereits eine private Zahnzusatzversicherung?"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium ax-text">Feldtyp</label>
          <select
            value={feldtyp}
            onChange={(e) => setFeldtyp(e.target.value as KampagnenFeld['feldtyp'])}
            className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
          >
            {Object.entries(FELDTYP_LABEL).map(([wert, label]) => (
              <option key={wert} value={wert}>{label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm ax-text cursor-pointer">
            <input
              type="checkbox"
              checked={pflichtfeld}
              onChange={(e) => setPflichtfeld(e.target.checked)}
              className="rounded"
            />
            Pflichtfeld
          </label>
        </div>
      </div>

      {feldtyp === 'auswahl' && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium ax-text">Optionen (komma-separiert)</label>
          <input
            type="text"
            value={optionen}
            onChange={(e) => setOptionen(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
            placeholder="Option 1, Option 2, Option 3"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-medium ax-text">Platzhalter (optional)</label>
        <input
          type="text"
          value={platzhalter}
          onChange={(e) => setPlatzhalter(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe"
          placeholder="Hinweistext im Eingabefeld"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onAbbrechen}
          className="border ax-rahmen-leicht ax-text px-3 py-1.5 rounded-lg text-xs"
        >
          Abbrechen
        </button>
        <button
          onClick={absenden}
          disabled={speichern || !bezeichnung.trim()}
          className="flex items-center gap-1 bg-axano-orange hover:bg-orange-600 text-white font-semibold px-3 py-1.5 rounded-lg text-xs disabled:opacity-50"
        >
          <Save className="w-3 h-3" strokeWidth={2.2} />
          Speichern
        </button>
      </div>
    </div>
  );
}
