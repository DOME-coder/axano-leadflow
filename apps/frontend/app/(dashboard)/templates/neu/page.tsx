'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Eye } from 'lucide-react';
import { benutzeTemplateErstellen } from '@/hooks/benutze-templates';

const verfuegbareVariablen = [
  '{{vorname}}', '{{nachname}}', '{{email}}', '{{telefon}}',
  '{{status}}', '{{kampagne_name}}', '{{erstellt_am}}', '{{zugewiesen_an}}',
];

export default function NeuesTemplateSeite() {
  const router = useRouter();
  const erstellen = benutzeTemplateErstellen();

  const [name, setName] = useState('');
  const [betreff, setBetreff] = useState('');
  const [htmlInhalt, setHtmlInhalt] = useState('');
  const [vorschau, setVorschau] = useState(false);
  const [fehler, setFehler] = useState('');

  const variableEinfuegen = (variable: string) => {
    setHtmlInhalt((prev) => prev + variable);
  };

  const absenden = async () => {
    setFehler('');
    if (!name.trim() || !betreff.trim() || !htmlInhalt.trim()) {
      setFehler('Name, Betreff und Inhalt sind erforderlich');
      return;
    }

    try {
      await erstellen.mutateAsync({
        name: name.trim(),
        betreff: betreff.trim(),
        htmlInhalt: htmlInhalt.trim(),
      });
      router.push('/templates');
    } catch {
      setFehler('Fehler beim Erstellen des Templates');
    }
  };

  // Vorschau: Variablen mit Beispieldaten ersetzen
  const vorschauHtml = htmlInhalt
    .replace(/\{\{vorname\}\}/g, 'Max')
    .replace(/\{\{nachname\}\}/g, 'Mustermann')
    .replace(/\{\{email\}\}/g, 'max@beispiel.de')
    .replace(/\{\{telefon\}\}/g, '+491511234567')
    .replace(/\{\{status\}\}/g, 'Neu')
    .replace(/\{\{kampagne_name\}\}/g, 'Beispiel-Kampagne')
    .replace(/\{\{erstellt_am\}\}/g, new Date().toLocaleDateString('de-DE'))
    .replace(/\{\{zugewiesen_an\}\}/g, 'Lisa Müller');

  return (
    <div className="animate-einblenden max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg ax-text-tertiaer ax-hover hover:text-[var(--text)] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold ax-titel">Neues E-Mail-Template</h1>
      </div>

      {fehler && (
        <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 text-sm rounded-lg p-3 mb-4">
          {fehler}
        </div>
      )}

      <div className="ax-karte rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">Template-Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              placeholder="z.B. Follow-up E-Mail"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">Betreff *</label>
            <input
              type="text"
              value={betreff}
              onChange={(e) => setBetreff(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe"
              placeholder="z.B. Hallo {{vorname}}, wir haben versucht..."
            />
          </div>
        </div>

        {/* Variablen-Buttons */}
        <div>
          <label className="text-sm font-medium ax-text mb-1.5 block">Variablen einfügen</label>
          <div className="flex flex-wrap gap-1.5">
            {verfuegbareVariablen.map((v) => (
              <button
                key={v}
                onClick={() => variableEinfuegen(v)}
                className="text-xs ax-karte-erhoeht ax-text px-2 py-1 rounded font-mono transition-all hover:opacity-80"
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Editor / Vorschau Toggle */}
        <div className="flex items-center gap-2 border-b ax-rahmen-leicht pb-2">
          <button
            onClick={() => setVorschau(false)}
            className={`text-sm font-medium px-3 py-1 rounded transition-all ${!vorschau ? 'bg-axano-primaer text-white' : 'ax-text-sekundaer ax-hover'}`}
          >
            Editor
          </button>
          <button
            onClick={() => setVorschau(true)}
            className={`text-sm font-medium px-3 py-1 rounded transition-all flex items-center gap-1 ${vorschau ? 'bg-axano-primaer text-white' : 'ax-text-sekundaer ax-hover'}`}
          >
            <Eye className="w-3.5 h-3.5" />
            Vorschau
          </button>
        </div>

        {vorschau ? (
          <div className="border ax-rahmen-leicht rounded-lg p-4 min-h-[200px]">
            <div className="text-sm ax-text" dangerouslySetInnerHTML={{ __html: vorschauHtml }} />
          </div>
        ) : (
          <textarea
            value={htmlInhalt}
            onChange={(e) => setHtmlInhalt(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe font-mono resize-none"
            rows={12}
            placeholder="<h1>Hallo {{vorname}},</h1><p>wir haben versucht Sie zu erreichen...</p>"
          />
        )}
      </div>

      {/* Aktionen */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={() => router.back()}
          className="border ax-rahmen-leicht ax-text font-medium px-5 py-2.5 rounded-lg transition-all text-sm ax-hover"
        >
          Abbrechen
        </button>
        <button
          onClick={absenden}
          disabled={erstellen.isPending}
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm disabled:opacity-50 flex items-center gap-2"
        >
          {erstellen.isPending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Template speichern
        </button>
      </div>
    </div>
  );
}
