'use client';

import Link from 'next/link';
import { Zap, ArrowRight } from 'lucide-react';
import { benutzeKampagnen } from '@/hooks/benutze-kampagnen';

export default function AutomatisierungenSeite() {
  const { data, isLoading } = benutzeKampagnen({ status: 'aktiv' });

  return (
    <div className="animate-einblenden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold ax-titel">Automatisierungen</h1>
        <p className="text-sm ax-text-sekundaer mt-1">
          Wählen Sie eine Kampagne, um deren Automatisierungen zu verwalten
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" />
          ))}
        </div>
      ) : !data?.eintraege.length ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <Zap className="w-12 h-12 text-axano-sky-blue mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">
            Keine aktiven Kampagnen
          </h3>
          <p className="text-sm ax-text-sekundaer">
            Erstellen Sie zuerst eine Kampagne, um Automatisierungen zu konfigurieren.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.eintraege.map((kampagne) => (
            <Link
              key={kampagne.id}
              href={`/kampagnen/${kampagne.id}/automatisierungen`}
              className="ax-karte rounded-xl p-5 flex items-center justify-between hover:shadow-sm hover:border-axano-orange/30 transition-all group block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg ax-karte-erhoeht flex items-center justify-center">
                  <Zap className="w-5 h-5 text-axano-orange" />
                </div>
                <div>
                  <h3 className="font-semibold ax-titel text-sm group-hover:text-axano-orange transition-colors">
                    {kampagne.name}
                  </h3>
                  <p className="text-xs ax-text-sekundaer">
                    {kampagne.statistiken?.gesamtLeads || 0} Leads
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 ax-text-tertiaer group-hover:text-axano-orange transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
