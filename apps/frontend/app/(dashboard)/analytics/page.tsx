'use client';

import { useState } from 'react';
import { BarChart2, Mail, MessageSquare } from 'lucide-react';
import { benutzeKampagnen } from '@/hooks/benutze-kampagnen';
import { benutzeKampagnenAnalytics } from '@/hooks/benutze-analytics';
import { LeadZeitreihe, StatusVerteilung, QuellenAufschluesselung } from '@/components/analytics/diagramme';

const zeitraeume = [
  { wert: 'heute', bezeichnung: 'Heute' },
  { wert: 'woche', bezeichnung: 'Woche' },
  { wert: 'monat', bezeichnung: 'Monat' },
  { wert: 'quartal', bezeichnung: 'Quartal' },
];

export default function AnalyticsSeite() {
  const { data: kampagnen } = benutzeKampagnen();
  const [kampagneId, setKampagneId] = useState('');
  const [zeitraum, setZeitraum] = useState('woche');

  const ersteKampagneId = kampagneId || kampagnen?.eintraege[0]?.id || '';
  const { data: analytics, isLoading } = benutzeKampagnenAnalytics(ersteKampagneId, zeitraum);

  return (
    <div className="animate-einblenden">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold ax-titel">Analytics</h1>
          <p className="text-sm ax-text-sekundaer mt-1">
            Auswertungen und Berichte
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Kampagnen-Auswahl */}
          <select
            value={ersteKampagneId}
            onChange={(e) => setKampagneId(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg ax-eingabe"
          >
            {kampagnen?.eintraege.map((k) => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>

          {/* Zeitraum-Filter */}
          <div className="flex ax-karte-erhoeht rounded-lg p-0.5">
            {zeitraeume.map((z) => (
              <button
                key={z.wert}
                onClick={() => setZeitraum(z.wert)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  zeitraum === z.wert
                    ? 'bg-axano-primaer text-white'
                    : 'ax-text-sekundaer hover:text-[var(--titel)]'
                }`}
              >
                {z.bezeichnung}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!ersteKampagneId ? (
        <div className="ax-karte rounded-xl p-12 text-center">
          <BarChart2 className="w-12 h-12 text-axano-sky-blue mx-auto mb-3" />
          <h3 className="text-lg font-semibold ax-titel mb-1">
            Keine Kampagnen vorhanden
          </h3>
          <p className="text-sm ax-text-sekundaer">
            Erstellen Sie eine Kampagne, um Analytics zu sehen.
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-80 rounded-xl" />
          ))}
        </div>
      ) : analytics ? (
        <>
          {/* KPI-Zusammenfassung */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="ax-karte rounded-xl p-4">
              <p className="text-xs ax-text-sekundaer uppercase">Gesamt-Leads</p>
              <p className="text-2xl font-bold ax-titel">{analytics.gesamtLeads}</p>
            </div>
            <div className="ax-karte rounded-xl p-4">
              <p className="text-xs ax-text-sekundaer uppercase">Conversion</p>
              <p className="text-2xl font-bold text-axano-orange">{analytics.conversionRate}%</p>
            </div>
            <div className="ax-karte rounded-xl p-4 flex items-center gap-3">
              <Mail className="w-5 h-5 ax-text-tertiaer" />
              <div>
                <p className="text-xs ax-text-sekundaer uppercase">E-Mails</p>
                <p className="text-2xl font-bold ax-titel">{analytics.automatisierungen.emailsGesendet}</p>
              </div>
            </div>
            <div className="ax-karte rounded-xl p-4 flex items-center gap-3">
              <MessageSquare className="w-5 h-5 ax-text-tertiaer" />
              <div>
                <p className="text-xs ax-text-sekundaer uppercase">WhatsApp</p>
                <p className="text-2xl font-bold ax-titel">{analytics.automatisierungen.whatsappGesendet}</p>
              </div>
            </div>
          </div>

          {/* Diagramme */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="ax-karte rounded-xl p-5">
              <h3 className="font-semibold ax-titel text-sm mb-4">Leads über Zeit</h3>
              {analytics.leadsZeitreihe.length > 0 ? (
                <LeadZeitreihe daten={analytics.leadsZeitreihe} />
              ) : (
                <p className="text-sm ax-text-tertiaer text-center py-12">Keine Daten im gewählten Zeitraum</p>
              )}
            </div>

            <div className="ax-karte rounded-xl p-5">
              <h3 className="font-semibold ax-titel text-sm mb-4">Status-Verteilung</h3>
              {Object.keys(analytics.statusVerteilung).length > 0 ? (
                <StatusVerteilung daten={analytics.statusVerteilung} />
              ) : (
                <p className="text-sm ax-text-tertiaer text-center py-12">Keine Daten vorhanden</p>
              )}
            </div>

            <div className="ax-karte rounded-xl p-5">
              <h3 className="font-semibold ax-titel text-sm mb-4">Quellen-Aufschlüsselung</h3>
              {Object.keys(analytics.quellenVerteilung).length > 0 ? (
                <QuellenAufschluesselung daten={analytics.quellenVerteilung} />
              ) : (
                <p className="text-sm ax-text-tertiaer text-center py-12">Keine Daten vorhanden</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
