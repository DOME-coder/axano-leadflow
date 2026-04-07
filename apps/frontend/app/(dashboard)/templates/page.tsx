'use client';

import Link from 'next/link';
import { Plus, FileText, Trash2, Eye, X } from 'lucide-react';
import { benutzeTemplates } from '@/hooks/benutze-templates';
import { apiClient } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { EmailTemplate } from '@/lib/typen';

export default function TemplatesSeite() {
  const { data: templates, isLoading } = benutzeTemplates();
  const queryClient = useQueryClient();
  const [vorschauTemplate, setVorschauTemplate] = useState<EmailTemplate | null>(null);

  const beispielDaten: Record<string, string> = {
    '{{vorname}}': 'Max',
    '{{nachname}}': 'Mustermann',
    '{{email}}': 'max@beispiel.de',
    '{{telefon}}': '+49 170 1234567',
    '{{firma}}': 'Musterfirma GmbH',
    '{{kampagne}}': 'Beispiel-Kampagne',
    '{{datum}}': new Date().toLocaleDateString('de-DE'),
    '{{calendlyLink}}': 'https://calendly.com/beispiel',
  };

  const vorschauErstellen = (html: string): string => {
    let ergebnis = html;
    for (const [platzhalter, wert] of Object.entries(beispielDaten)) {
      ergebnis = ergebnis.replaceAll(platzhalter, wert);
    }
    return ergebnis;
  };

  const loeschen = async (id: string) => {
    if (!confirm('Template wirklich löschen?')) return;
    await apiClient.delete(`/templates/${id}`);
    queryClient.invalidateQueries({ queryKey: ['templates'] });
  };

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold ax-titel">E-Mail-Templates</h1>
          <p className="text-sm ax-text-sekundaer mt-1">
            Verwalten Sie Ihre E-Mail-Vorlagen
          </p>
        </div>
        <Link
          href="/templates/neu"
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all active:scale-95 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Neues Template
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : !templates?.length ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <FileText className="w-12 h-12 text-axano-sky-blue mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">
            Noch keine Templates
          </h3>
          <p className="text-sm ax-text-sekundaer mb-4">
            Erstellen Sie E-Mail-Vorlagen für Ihre Automatisierungen.
          </p>
          <Link
            href="/templates/neu"
            className="inline-flex items-center gap-2 bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm"
          >
            <Plus className="w-4 h-4" />
            Erstes Template erstellen
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="ax-karte rounded-xl p-5 flex items-center justify-between hover:shadow-sm transition-all"
            >
              <div>
                <h3 className="font-semibold ax-titel text-sm">{template.name}</h3>
                <p className="text-xs ax-text-sekundaer mt-0.5">
                  Betreff: {template.betreff}
                </p>
                <p className="text-xs ax-text-tertiaer mt-0.5">
                  Version {template.version} · {new Date(template.erstelltAm).toLocaleDateString('de-DE')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono ax-text-tertiaer ax-karte-erhoeht px-2 py-1 rounded">
                  {template.id.substring(0, 8)}...
                </span>
                <button
                  onClick={() => setVorschauTemplate(template)}
                  className="p-2 rounded-lg ax-text-tertiaer hover:bg-axano-orange/10 hover:text-axano-orange transition-all"
                  title="Vorschau anzeigen"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => loeschen(template.id)}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vorschau-Modal */}
      {vorschauTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setVorschauTemplate(null)}
          />
          <div className="relative ax-karte rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col animate-einblenden">
            <div className="flex items-center justify-between p-5 border-b ax-rahmen-leicht">
              <div>
                <h2 className="text-lg font-bold ax-titel">Vorschau: {vorschauTemplate.name}</h2>
                <p className="text-xs ax-text-sekundaer mt-0.5">Betreff: {vorschauTemplate.betreff}</p>
              </div>
              <button
                onClick={() => setVorschauTemplate(null)}
                className="p-2 rounded-lg ax-text-tertiaer ax-hover hover:text-[var(--text)] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-white rounded-lg border p-6">
                <iframe
                  srcDoc={vorschauErstellen(vorschauTemplate.htmlInhalt)}
                  className="w-full border-0"
                  style={{ minHeight: '400px' }}
                  title="Template-Vorschau"
                  sandbox=""
                />
              </div>
              <div className="mt-4 ax-karte-erhoeht rounded-lg p-3">
                <p className="text-xs font-semibold ax-text-sekundaer mb-2">Verwendete Beispieldaten:</p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(beispielDaten).map(([platzhalter, wert]) => (
                    <p key={platzhalter} className="text-xs ax-text-tertiaer">
                      <span className="font-mono">{platzhalter}</span> → {wert}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
