'use client';

import Link from 'next/link';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { benutzeTemplates } from '@/hooks/benutze-templates';
import { apiClient } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';

export default function TemplatesSeite() {
  const { data: templates, isLoading } = benutzeTemplates();
  const queryClient = useQueryClient();

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
    </div>
  );
}
