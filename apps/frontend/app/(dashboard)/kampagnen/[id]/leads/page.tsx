'use client';

import { KanbanBoard } from '@/components/leads/kanban-board';
import { benutzeKampagne } from '@/hooks/benutze-kampagnen';
import { benutzeEchtzeit } from '@/hooks/benutze-echtzeit';
import { ArrowLeft, Copy, Check, Settings, Phone, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function KampagneLeadsSeite({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: kampagne, isLoading } = benutzeKampagne(id);
  const [kopiert, setKopiert] = useState(false);

  // Echtzeit-Updates für diese Kampagne
  benutzeEchtzeit(id);

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
        <KanbanBoard kampagneId={id} />
      </div>
    </div>
  );
}
