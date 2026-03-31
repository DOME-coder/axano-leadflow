'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { Kampagne, IntegrationStatus } from '@/lib/typen';
import { quellenFarben } from '@/lib/typen';

const statusAnzeige: Record<string, { farbe: string; text: string }> = {
  aktiv: { farbe: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', text: 'Aktiv' },
  pausiert: { farbe: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', text: 'Pausiert' },
  archiviert: { farbe: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', text: 'Archiviert' },
};

const triggerBezeichnungen: Record<string, string> = {
  facebook_lead_ads: 'Facebook Lead Ads',
  webhook: 'Webhook',
  email: 'E-Mail',
  whatsapp: 'WhatsApp',
  webformular: 'Webformular',
};

function kampagneAmpel(kampagne: Kampagne, integrationen?: IntegrationStatus[]): { farbe: string; titel: string } {
  if (!integrationen) return { farbe: 'bg-gray-400', titel: 'Status wird geladen...' };

  const istAktiv = (name: string) => integrationen.find((i) => i.name === name)?.aktiv ?? false;
  const benoetigt: string[] = [];

  if (kampagne.vapiAktiviert) { benoetigt.push('vapi'); benoetigt.push('openai'); }
  if (kampagne.emailAktiviert) benoetigt.push('smtp');
  if (kampagne.whatsappAktiviert) benoetigt.push('superchat');

  if (benoetigt.length === 0) return { farbe: 'bg-green-500', titel: 'Keine Integrationen benötigt' };

  const fehlend = benoetigt.filter((b) => !istAktiv(b));
  if (fehlend.length === 0) return { farbe: 'bg-green-500', titel: 'Alle Integrationen aktiv' };
  if (fehlend.length === benoetigt.length) return { farbe: 'bg-red-500', titel: `Fehlt: ${fehlend.join(', ')}` };
  return { farbe: 'bg-amber-500', titel: `Fehlt: ${fehlend.join(', ')}` };
}

interface KampagnenKarteProps {
  kampagne: Kampagne;
  integrationsStatus?: IntegrationStatus[];
}

export function KampagnenKarte({ kampagne, integrationsStatus }: KampagnenKarteProps) {
  const status = statusAnzeige[kampagne.status] || statusAnzeige.aktiv;
  const quellenFarbe = quellenFarben[kampagne.triggerTyp] || 'bg-gray-100 text-gray-700';
  const ampel = kampagneAmpel(kampagne, integrationsStatus);

  return (
    <Link href={`/kampagnen/${kampagne.id}/leads`}
      className="ax-karte rounded-xl p-5 hover:shadow-sm hover:border-axano-orange/30 transition-all group block">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ampel.farbe}`} title={ampel.titel} />
          <h3 className="font-semibold ax-titel text-sm truncate group-hover:text-axano-orange transition-colors">
            {kampagne.name}
          </h3>
        </div>
        <ArrowUpRight className="w-4 h-4 ax-text-tertiaer group-hover:text-axano-orange transition-colors flex-shrink-0 ml-2" />
      </div>

      {kampagne.beschreibung && (
        <p className="text-xs ax-text-tertiaer mb-3 truncate">{kampagne.beschreibung}</p>
      )}

      <div className="flex items-center gap-2 mb-4">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.farbe}`}>{status.text}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${quellenFarbe}`}>
          {triggerBezeichnungen[kampagne.triggerTyp] || kampagne.triggerTyp}
        </span>
      </div>

      {kampagne.statistiken && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t ax-rahmen-leicht">
          <div>
            <p className="text-xs ax-text-tertiaer">Gesamt</p>
            <p className="text-lg font-bold ax-titel">{kampagne.statistiken.gesamtLeads}</p>
          </div>
          <div>
            <p className="text-xs ax-text-tertiaer">Heute</p>
            <p className="text-lg font-bold ax-titel">{kampagne.statistiken.leadsHeute}</p>
          </div>
          <div>
            <p className="text-xs ax-text-tertiaer">Conversion</p>
            <p className="text-lg font-bold text-axano-orange">{kampagne.statistiken.conversionRate}%</p>
          </div>
        </div>
      )}
    </Link>
  );
}
