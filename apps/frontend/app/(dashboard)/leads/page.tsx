'use client';

import Link from 'next/link';
import { Users, ArrowRight } from 'lucide-react';
import { benutzeKampagnen } from '@/hooks/benutze-kampagnen';

export default function LeadsSeite() {
  const { data, isLoading } = benutzeKampagnen();

  return (
    <div className="animate-einblenden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold ax-titel">Leads</h1>
        <p className="text-sm ax-text-sekundaer mt-1">
          Wählen Sie eine Kampagne, um deren Leads zu sehen
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
          <Users className="w-12 h-12 text-axano-sky-blue mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">
            Keine Kampagnen vorhanden
          </h3>
          <p className="text-sm ax-text-sekundaer">
            Erstellen Sie zuerst eine Kampagne, um Leads zu empfangen.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.eintraege.map((kampagne) => (
            <Link
              key={kampagne.id}
              href={`/kampagnen/${kampagne.id}/leads`}
              className="ax-karte rounded-xl p-5 flex items-center justify-between hover:shadow-sm hover:border-axano-orange/30 transition-all group block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg ax-karte-erhoeht flex items-center justify-center">
                  <Users className="w-5 h-5 text-[var(--titel)]" />
                </div>
                <div>
                  <h3 className="font-semibold ax-titel text-sm group-hover:text-axano-orange transition-colors">
                    {kampagne.name}
                  </h3>
                  <p className="text-xs ax-text-sekundaer">
                    {kampagne.statistiken?.gesamtLeads || 0} Leads · {kampagne.statistiken?.leadsHeute || 0} heute
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
