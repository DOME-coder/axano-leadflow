'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Zap, Power, Trash2 } from 'lucide-react';
import { benutzeKampagne } from '@/hooks/benutze-kampagnen';
import {
  benutzeAutomatisierungen,
  benutzeAutomatisierungAktualisieren,
  benutzeAutomatisierungLoeschen,
} from '@/hooks/benutze-automatisierungen';
import { AutomatisierungsEditor } from '@/components/kampagnen/automatisierungs-editor';
import { benutzeKampagneKundenWaechter } from '@/hooks/benutze-kampagne-kunden-waechter';

const triggerBezeichnungen: Record<string, string> = {
  lead_eingetroffen: 'Lead eingetroffen',
  status_geaendert: 'Status geändert',
  inaktivitaet: 'Inaktivität',
  zeitplan: 'Zeitplan',
};

const aktionBezeichnungen: Record<string, string> = {
  email_senden: 'E-Mail senden',
  whatsapp_senden: 'WhatsApp senden',
  status_setzen: 'Status setzen',
  benachrichtigung: 'Benachrichtigung',
  warten: 'Warten',
  warten_bis_uhrzeit: 'Warten bis Uhrzeit',
};

export default function AutomatisierungenSeite({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: kampagne } = benutzeKampagne(id);
  benutzeKampagneKundenWaechter(kampagne?.kundeId);
  const { data: automatisierungen, isLoading } = benutzeAutomatisierungen(id);
  const aktualisieren = benutzeAutomatisierungAktualisieren();
  const loeschen = benutzeAutomatisierungLoeschen();
  const [editorOffen, setEditorOffen] = useState(false);

  const toggleAktiv = (autoId: string, aktiv: boolean) => {
    aktualisieren.mutate({ id: autoId, aktiv: !aktiv });
  };

  const handleLoeschen = (autoId: string) => {
    if (!confirm('Automatisierung wirklich löschen?')) return;
    loeschen.mutate(autoId, {
      onSuccess: () => {
        console.log('Automatisierung gelöscht:', autoId);
      },
      onError: (fehler) => {
        console.error('Löschen fehlgeschlagen:', fehler);
      },
    });
  };

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/kampagnen/${id}/leads`}
            className="p-1.5 rounded-lg ax-text-tertiaer ax-hover hover:text-[var(--text)] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold ax-titel">Automatisierungen</h1>
            <p className="text-xs ax-text-sekundaer">{kampagne?.name}</p>
          </div>
        </div>
        <button
          onClick={() => setEditorOffen(true)}
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all active:scale-95 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Neue Automatisierung
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" />
          ))}
        </div>
      ) : !automatisierungen?.length ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <Zap className="w-12 h-12 text-axano-sky-blue mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">
            Noch keine Automatisierungen
          </h3>
          <p className="text-sm ax-text-sekundaer mb-4">
            Erstellen Sie Automatisierungen, um Leads automatisch zu bearbeiten.
          </p>
          <button
            onClick={() => setEditorOffen(true)}
            className="inline-flex items-center gap-2 bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Erste Automatisierung erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {automatisierungen.map((auto) => (
            <div
              key={auto.id}
              className={`ax-karte rounded-xl p-5 transition-all ${
                !auto.aktiv ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold ax-titel text-sm">{auto.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      auto.aktiv ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {auto.aktiv ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  {auto.beschreibung && (
                    <p className="text-xs ax-text-sekundaer mb-2">{auto.beschreibung}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs ax-text-sekundaer">
                    <span className="ax-karte-erhoeht px-2 py-1 rounded font-medium">
                      Trigger: {triggerBezeichnungen[auto.triggerTyp] || auto.triggerTyp}
                    </span>
                    <span>
                      {auto.schritte.length} {auto.schritte.length === 1 ? 'Schritt' : 'Schritte'}:
                      {' '}{auto.schritte.map((s) => aktionBezeichnungen[s.aktionTyp] || s.aktionTyp).join(' → ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => toggleAktiv(auto.id, auto.aktiv)}
                    className={`p-2 rounded-lg transition-all ${
                      auto.aktiv
                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                    title={auto.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleLoeschen(auto.id)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOffen && (
        <AutomatisierungsEditor
          kampagneId={id}
          onSchliessen={() => setEditorOffen(false)}
        />
      )}
    </div>
  );
}
