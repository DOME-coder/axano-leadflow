'use client';

import { Users, Megaphone, Zap, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { benutzeUebersicht } from '@/hooks/benutze-analytics';
import { benutzeKampagnen } from '@/hooks/benutze-kampagnen';
import { benutzeIntegrationsStatus } from '@/hooks/benutze-integrationen';
import Link from 'next/link';

export default function DashboardSeite() {
  const { data: uebersicht, isLoading } = benutzeUebersicht();
  const { data: kampagnen } = benutzeKampagnen({ status: 'aktiv' });
  const { data: integrationsStatus } = benutzeIntegrationsStatus();

  const kritischeIntegrationen = [
    { name: 'vapi', warnung: 'VAPI nicht konfiguriert — KI-Anrufe deaktiviert' },
    { name: 'smtp', warnung: 'SMTP fehlt — E-Mail-Versand nicht möglich' },
    { name: 'openai', warnung: 'OpenAI nicht konfiguriert — Transkript-Analyse deaktiviert' },
    { name: 'superchat', warnung: 'Superchat fehlt — WhatsApp-Versand nicht möglich' },
  ];

  const fehlendeIntegrationen = kritischeIntegrationen.filter((ki) => {
    const status = integrationsStatus?.find((s) => s.name === ki.name);
    return !status?.aktiv;
  });

  const kpis = [
    { bezeichnung: 'Gesamt-Leads', wert: uebersicht?.gesamtLeads ?? '—', icon: Users, farbe: 'ax-titel' },
    { bezeichnung: 'Aktive Kampagnen', wert: uebersicht?.aktiveKampagnen ?? '—', icon: Megaphone, farbe: 'ax-titel' },
    { bezeichnung: 'Conversion-Rate', wert: uebersicht ? `${uebersicht.conversionRateGesamt}%` : '—', icon: TrendingUp, farbe: 'text-axano-orange' },
    { bezeichnung: 'Leads heute', wert: uebersicht?.leadsHeute ?? '—', icon: Zap, farbe: 'text-green-500' },
  ];

  return (
    <div className="animate-einblenden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold ax-titel">Dashboard</h1>
        <p className="text-sm ax-text-sekundaer mt-1">Willkommen bei Axano LeadFlow</p>
      </div>

      {/* Integrations-Status */}
      {integrationsStatus && fehlendeIntegrationen.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                {fehlendeIntegrationen.length} Integration{fehlendeIntegrationen.length > 1 ? 'en' : ''} nicht konfiguriert
              </p>
              <ul className="space-y-0.5">
                {fehlendeIntegrationen.map((fi) => (
                  <li key={fi.name} className="text-xs text-amber-700 dark:text-amber-400">{fi.warnung}</li>
                ))}
              </ul>
              <Link href="/einstellungen/integrationen" className="text-xs font-medium text-axano-orange hover:underline mt-2 inline-block">
                Integrationen konfigurieren →
              </Link>
            </div>
          </div>
        </div>
      )}

      {integrationsStatus && fehlendeIntegrationen.length === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <p className="text-xs font-medium text-green-700 dark:text-green-400">Alle Integrationen aktiv</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.bezeichnung} className="ax-karte rounded-xl p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium ax-text-sekundaer uppercase tracking-wide">{kpi.bezeichnung}</p>
              <kpi.icon className="w-4 h-4 ax-text-tertiaer" />
            </div>
            {isLoading ? (
              <div className="skeleton h-9 w-20 rounded" />
            ) : (
              <p className={`text-3xl font-bold ${kpi.farbe}`}>{kpi.wert}</p>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="ax-karte rounded-xl p-5">
          <h3 className="font-semibold ax-titel text-sm mb-4">Zeitraum-Übersicht</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm ax-text-sekundaer">Leads diese Woche</span>
              <span className="font-bold ax-titel">{uebersicht?.leadsDieseWoche ?? '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm ax-text-sekundaer">Leads diesen Monat</span>
              <span className="font-bold ax-titel">{uebersicht?.leadsMonat ?? '—'}</span>
            </div>
          </div>
        </div>

        <div className="ax-karte rounded-xl p-5">
          <h3 className="font-semibold ax-titel text-sm mb-4">Aktive Kampagnen</h3>
          {kampagnen?.eintraege.length ? (
            <div className="space-y-2">
              {kampagnen.eintraege.slice(0, 5).map((k) => (
                <Link key={k.id} href={`/kampagnen/${k.id}/leads`}
                  className="flex justify-between items-center p-2 rounded-lg ax-hover transition-all">
                  <span className="text-sm ax-text font-medium">{k.name}</span>
                  <span className="text-xs ax-text-tertiaer">{k.statistiken?.gesamtLeads || 0} Leads</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm ax-text-tertiaer">Keine aktiven Kampagnen</p>
          )}
        </div>
      </div>
    </div>
  );
}
