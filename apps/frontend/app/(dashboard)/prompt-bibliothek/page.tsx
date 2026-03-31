'use client';

import { useState } from 'react';
import { BookOpen, Plus, Search, Trash2, Save, X } from 'lucide-react';
import { benutzePromptVorlagen, benutzePromptVorlageErstellen, benutzePromptVorlageAktualisieren, benutzePromptVorlageLoeschen } from '@/hooks/benutze-prompt-vorlagen';
import type { PromptVorlage } from '@/lib/typen';

export default function PromptBibliothekSeite() {
  const [suche, setSuche] = useState('');
  const { data: vorlagen, isLoading } = benutzePromptVorlagen({ branche: suche || undefined });
  const erstellen = benutzePromptVorlageErstellen();
  const aktualisieren = benutzePromptVorlageAktualisieren();
  const loeschen = benutzePromptVorlageLoeschen();

  const [neuFormular, setNeuFormular] = useState(false);
  const [bearbeitung, setBearbeitung] = useState<PromptVorlage | null>(null);
  const [form, setForm] = useState({ name: '', branche: '', produkt: '', vapiPrompt: '' });

  const handleErstellen = async () => {
    if (!form.name || !form.branche || !form.vapiPrompt) return;
    await erstellen.mutateAsync({
      name: form.name,
      branche: form.branche,
      produkt: form.produkt || undefined,
      vapiPrompt: form.vapiPrompt,
    });
    setNeuFormular(false);
    setForm({ name: '', branche: '', produkt: '', vapiPrompt: '' });
  };

  const bearbeitungStarten = (vorlage: PromptVorlage) => {
    setBearbeitung(vorlage);
    setForm({
      name: vorlage.name,
      branche: vorlage.branche,
      produkt: vorlage.produkt || '',
      vapiPrompt: vorlage.vapiPrompt,
    });
  };

  const handleAktualisieren = async () => {
    if (!bearbeitung) return;
    await aktualisieren.mutateAsync({ id: bearbeitung.id, ...form });
    setBearbeitung(null);
  };

  const handleLoeschen = async (id: string) => {
    await loeschen.mutateAsync(id);
  };

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold ax-titel">Prompt-Bibliothek</h1>
          <p className="text-sm ax-text-sekundaer mt-1">Wiederverwendbare VAPI-Prompts nach Branche</p>
        </div>
        <button
          onClick={() => { setNeuFormular(true); setBearbeitung(null); setForm({ name: '', branche: '', produkt: '', vapiPrompt: '' }); }}
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Neue Vorlage
        </button>
      </div>

      {/* Suche */}
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ax-text-tertiaer" />
        <input
          type="text"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg ax-eingabe"
          placeholder="Nach Branche suchen..."
        />
      </div>

      {/* Erstellen / Bearbeiten Formular */}
      {(neuFormular || bearbeitung) && (
        <div className="ax-karte rounded-xl p-5 mb-4 border-2 border-axano-orange/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold ax-titel text-sm">
              {bearbeitung ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}
            </h3>
            <button onClick={() => { setNeuFormular(false); setBearbeitung(null); }}
              className="ax-text-tertiaer hover:ax-text p-1"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" placeholder="z.B. Pferdeversicherung Standard" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Branche *</label>
              <input value={form.branche} onChange={(e) => setForm({ ...form, branche: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" placeholder="z.B. Pferdeversicherung" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium ax-text">Produkt</label>
              <input value={form.produkt} onChange={(e) => setForm({ ...form, produkt: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe" placeholder="z.B. Krankenversicherung" />
            </div>
          </div>
          <div className="space-y-1 mb-3">
            <label className="text-xs font-medium ax-text">VAPI-Prompt *</label>
            <textarea value={form.vapiPrompt} onChange={(e) => setForm({ ...form, vapiPrompt: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg ax-eingabe resize-none" rows={8}
              placeholder="Vollständiges Gesprächsskript für den KI-Agenten..." />
          </div>
          <button
            onClick={bearbeitung ? handleAktualisieren : handleErstellen}
            disabled={!form.name || !form.branche || !form.vapiPrompt || erstellen.isPending || aktualisieren.isPending}
            className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {bearbeitung ? 'Aktualisieren' : 'Erstellen'}
          </button>
        </div>
      )}

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ax-karte rounded-xl p-5 h-24">
              <div className="skeleton h-5 w-1/3 rounded mb-2" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          ))}
        </div>
      ) : vorlagen?.length === 0 ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <BookOpen className="w-12 h-12 ax-text-tertiaer mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">Keine Prompt-Vorlagen</h3>
          <p className="text-sm ax-text-sekundaer mb-4">
            Prompts werden automatisch gespeichert wenn Sie eine Kampagne mit KI-Generierung erstellen.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {vorlagen?.map((vorlage) => (
            <div key={vorlage.id} className="ax-karte rounded-xl p-5 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => bearbeitungStarten(vorlage)}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold ax-titel text-sm">{vorlage.name}</h3>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {vorlage.branche}
                    </span>
                    {vorlage.produkt && (
                      <span className="text-xs ax-text-tertiaer">{vorlage.produkt}</span>
                    )}
                  </div>
                  <p className="text-xs ax-text-sekundaer truncate">
                    {vorlage.vapiPrompt.substring(0, 120)}...
                  </p>
                  <p className="text-xs ax-text-tertiaer mt-1">
                    v{vorlage.version} · {new Date(vorlage.erstelltAm).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <button
                  onClick={() => handleLoeschen(vorlage.id)}
                  className="p-1.5 ax-text-tertiaer hover:text-red-500 transition-colors flex-shrink-0 ml-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
