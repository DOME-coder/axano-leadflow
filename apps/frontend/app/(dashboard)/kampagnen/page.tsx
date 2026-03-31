'use client';

import Link from 'next/link';
import { Plus, Megaphone } from 'lucide-react';
import { benutzeKampagnen } from '@/hooks/benutze-kampagnen';
import { benutzeIntegrationsStatus } from '@/hooks/benutze-integrationen';
import { KampagnenKarte } from '@/components/kampagnen/kampagnen-karte';

export default function KampagnenSeite() {
  const { data, isLoading } = benutzeKampagnen();
  const { data: integrationsStatus } = benutzeIntegrationsStatus();

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold ax-titel">Kampagnen</h1>
          <p className="text-sm ax-text-sekundaer mt-1">Verwalten Sie Ihre Lead-Kampagnen</p>
        </div>
        <Link href="/kampagnen/neu"
          className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all active:scale-95 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4" /> Neue Kampagne
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="ax-karte rounded-xl p-5 h-48">
              <div className="skeleton h-5 w-2/3 rounded mb-3" />
              <div className="skeleton h-4 w-1/2 rounded mb-6" />
              <div className="skeleton h-8 w-full rounded" />
            </div>
          ))}
        </div>
      ) : data?.eintraege.length === 0 ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <Megaphone className="w-12 h-12 ax-text-tertiaer mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">Noch keine Kampagnen</h3>
          <p className="text-sm ax-text-sekundaer mb-4">Erstellen Sie Ihre erste Kampagne, um Leads zu empfangen.</p>
          <Link href="/kampagnen/neu"
            className="inline-flex items-center gap-2 bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm">
            <Plus className="w-4 h-4" /> Erste Kampagne erstellen
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data?.eintraege.map((kampagne) => (
            <KampagnenKarte key={kampagne.id} kampagne={kampagne} integrationsStatus={integrationsStatus} />
          ))}
        </div>
      )}
    </div>
  );
}
