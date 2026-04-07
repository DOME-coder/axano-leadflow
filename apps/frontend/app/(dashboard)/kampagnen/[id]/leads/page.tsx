'use client';

import { KanbanBoard } from '@/components/leads/kanban-board';
import { benutzeKampagne } from '@/hooks/benutze-kampagnen';
import { benutzeEchtzeit } from '@/hooks/benutze-echtzeit';
import { ArrowLeft, Copy, Check, Settings, Phone, LayoutGrid, Download, Trash2, RotateCcw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { benutzeLeads } from '@/hooks/benutze-leads';
import Link from 'next/link';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function KampagneLeadsSeite({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: kampagne, isLoading } = benutzeKampagne(id);
  const [kopiert, setKopiert] = useState(false);
  const [papierkorbAktiv, setPapierkorbAktiv] = useState(false);
  const [exportLaeuft, setExportLaeuft] = useState(false);

  // Echtzeit-Updates für diese Kampagne
  benutzeEchtzeit(id);

  const csvExportieren = async () => {
    setExportLaeuft(true);
    try {
      const antwort = await apiClient.get(`/kampagnen/${id}/leads/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([antwort.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads-${kampagne?.name || id}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Export fehlgeschlagen');
    } finally {
      setExportLaeuft(false);
    }
  };

  const webhookUrl = kampagne?.webhookSlug
    ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/webhooks/${kampagne.webhookSlug}`
    : null;

  const webhookKopieren = async () => {
    if (webhookUrl) {
      await navigator.clipboard.writeText(webhookUrl);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-einblenden">
        <div className="skeleton h-8 w-64 rounded mb-2" />
        <div className="skeleton h-4 w-48 rounded mb-6" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-96 w-72 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-einblenden h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Link
            href="/kampagnen"
            className="p-1.5 rounded-lg ax-text-tertiaer ax-hover hover:text-[var(--text)] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold ax-titel">
              {kampagne?.name || 'Kampagne'}
            </h1>
            {kampagne?.beschreibung && (
              <p className="text-xs ax-text-sekundaer">{kampagne.beschreibung}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {webhookUrl && (
            <button
              onClick={webhookKopieren}
              className="flex items-center gap-2 ax-karte-erhoeht ax-text px-3 py-2 rounded-lg text-xs font-mono transition-all hover:opacity-80"
            >
              {kopiert ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              <span className="max-w-[200px] truncate">{webhookUrl}</span>
            </button>
          )}
          <button
            onClick={csvExportieren}
            disabled={exportLaeuft}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ax-text-sekundaer ax-hover transition-all disabled:opacity-50"
            title="Leads als CSV exportieren"
          >
            <Download className="w-3.5 h-3.5" /> {exportLaeuft ? 'Exportiert...' : 'CSV Export'}
          </button>
          <button
            onClick={() => setPapierkorbAktiv(!papierkorbAktiv)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              papierkorbAktiv
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'ax-text-sekundaer ax-hover'
            }`}
            title="Gelöschte Leads anzeigen"
          >
            <Trash2 className="w-3.5 h-3.5" /> Papierkorb
          </button>
          <Link
            href={`/kampagnen/${id}/anrufe`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ax-text-sekundaer ax-hover transition-all"
          >
            <Phone className="w-3.5 h-3.5" /> Anrufe
          </Link>
          <Link
            href={`/kampagnen/${id}/einstellungen`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium ax-text-sekundaer ax-hover transition-all"
          >
            <Settings className="w-3.5 h-3.5" /> Einstellungen
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {papierkorbAktiv ? (
          <PapierkorbAnsicht kampagneId={id} />
        ) : (
          <KanbanBoard kampagneId={id} />
        )}
      </div>
    </div>
  );
}

function PapierkorbAnsicht({ kampagneId }: { kampagneId: string }) {
  const { data, isLoading } = benutzeLeads(kampagneId, { status: 'geloescht' });
  const queryClient = useQueryClient();

  const wiederherstellen = async (leadId: string) => {
    await apiClient.patch(`/leads/${leadId}`, { geloescht: false });
    queryClient.invalidateQueries({ queryKey: ['leads'] });
    queryClient.invalidateQueries({ queryKey: ['pipeline'] });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data?.eintraege.length) {
    return (
      <div className="ax-karte rounded-xl p-12 text-center mt-4">
        <Trash2 className="w-12 h-12 ax-text-tertiaer mx-auto mb-3" />
        <h3 className="text-lg font-semibold ax-titel mb-1">Papierkorb ist leer</h3>
        <p className="text-sm ax-text-sekundaer">Keine gelöschten Leads vorhanden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto mt-2" style={{ maxHeight: 'calc(100vh - 160px)' }}>
      {data.eintraege.map((lead) => (
        <div key={lead.id} className="ax-karte rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold ax-titel">
              {lead.vorname} {lead.nachname}
            </p>
            <p className="text-xs ax-text-sekundaer">
              {lead.email || lead.telefon || 'Keine Kontaktdaten'}
            </p>
            <p className="text-xs ax-text-tertiaer mt-0.5">
              Status: {lead.status} · {new Date(lead.erstelltAm).toLocaleDateString('de-DE')}
            </p>
          </div>
          <button
            onClick={() => wiederherstellen(lead.id)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Wiederherstellen
          </button>
        </div>
      ))}
    </div>
  );
}

