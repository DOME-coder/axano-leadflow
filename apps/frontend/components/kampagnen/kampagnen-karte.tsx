'use client';

import Link from 'next/link';
import { ArrowUpRight, Copy, Trash2 } from 'lucide-react';
import type { Kampagne, IntegrationStatus } from '@/lib/typen';
import { quellenFarben } from '@/lib/typen';
import { benutzeKampagneDuplizieren, benutzeKampagneLoeschen } from '@/hooks/benutze-kampagnen';

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

type AmpelStatus = 'ok' | 'warnung' | 'fehler' | 'laden';

const ampelFarben: Record<AmpelStatus, { punkt: string; glow: string }> = {
  ok: { punkt: '#22c55e', glow: 'rgba(34, 197, 94, 0.45)' },
  warnung: { punkt: '#f59e0b', glow: 'rgba(245, 158, 11, 0.45)' },
  fehler: { punkt: '#ef4444', glow: 'rgba(239, 68, 68, 0.45)' },
  laden: { punkt: '#94a3b8', glow: 'rgba(148, 163, 184, 0.35)' },
};

function kampagneAmpel(
  kampagne: Kampagne,
  integrationen?: IntegrationStatus[]
): { status: AmpelStatus; titel: string } {
  if (!integrationen) return { status: 'laden', titel: 'Status wird geladen…' };

  const istAktiv = (name: string) => integrationen.find((i) => i.name === name)?.aktiv ?? false;
  const benoetigt: string[] = [];

  if (kampagne.vapiAktiviert) { benoetigt.push('vapi'); benoetigt.push('anthropic'); }
  if (kampagne.emailAktiviert) benoetigt.push('smtp');
  if (kampagne.whatsappAktiviert) benoetigt.push('superchat');

  if (benoetigt.length === 0) return { status: 'ok', titel: 'Keine Integrationen benötigt' };

  const fehlend = benoetigt.filter((b) => !istAktiv(b));
  if (fehlend.length === 0) return { status: 'ok', titel: 'Alle Integrationen aktiv' };
  if (fehlend.length === benoetigt.length) return { status: 'fehler', titel: `Fehlt: ${fehlend.join(', ')}` };
  return { status: 'warnung', titel: `Fehlt: ${fehlend.join(', ')}` };
}

interface KampagnenKarteProps {
  kampagne: Kampagne;
  integrationsStatus?: IntegrationStatus[];
}

export function KampagnenKarte({ kampagne, integrationsStatus }: KampagnenKarteProps) {
  const status = statusAnzeige[kampagne.status] || statusAnzeige.aktiv;
  const quellenFarbe = quellenFarben[kampagne.triggerTyp] || 'bg-gray-100 text-gray-700';
  const ampel = kampagneAmpel(kampagne, integrationsStatus);
  const ampelFarbe = ampelFarben[ampel.status];
  const duplizieren = benutzeKampagneDuplizieren();
  const loeschen = benutzeKampagneLoeschen();
  const istAktiv = kampagne.status === 'aktiv';

  const duplizierenKlick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (duplizieren.isPending) return;
    duplizieren.mutate(kampagne.id);
  };

  const loeschenKlick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loeschen.isPending) return;
    if (!confirm(`Kampagne "${kampagne.name}" wirklich löschen? Sie kann im Papierkorb wiederhergestellt werden.`)) return;
    loeschen.mutate(kampagne.id);
  };

  return (
    <Link
      href={`/kampagnen/${kampagne.id}/leads`}
      className="ax-karte-interaktiv rounded-xl p-5 group block ax-fokus-ring"
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2.5">
          {/* Status-Ampel mit Glow */}
          <span
            className="relative flex flex-shrink-0"
            title={ampel.titel}
            aria-label={ampel.titel}
          >
            {istAktiv && ampel.status === 'ok' && (
              <span
                className="absolute inset-0 rounded-full animate-puls-sanft"
                style={{ backgroundColor: ampelFarbe.punkt, opacity: 0.4 }}
                aria-hidden
              />
            )}
            <span
              className="relative w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: ampelFarbe.punkt,
                boxShadow: `0 0 8px ${ampelFarbe.glow}`,
              }}
            />
          </span>
          <h3 className="font-semibold ax-titel text-sm truncate group-hover:text-axano-orange transition-colors duration-200 ease-sanft">
            {kampagne.name}
          </h3>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={duplizierenKlick}
            disabled={duplizieren.isPending}
            className="p-1.5 rounded-md ax-text-tertiaer hover:text-axano-orange hover:bg-[var(--akzent-orange-sanft)] transition-all duration-200 ease-sanft opacity-0 group-hover:opacity-100"
            title="Kampagne duplizieren"
            aria-label="Kampagne duplizieren"
          >
            <Copy className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <button
            onClick={loeschenKlick}
            disabled={loeschen.isPending}
            className="p-1.5 rounded-md ax-text-tertiaer hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 ease-sanft opacity-0 group-hover:opacity-100"
            title="Kampagne löschen"
            aria-label="Kampagne löschen"
          >
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
          <ArrowUpRight
            className="w-4 h-4 ax-text-tertiaer group-hover:text-axano-orange group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all duration-200 ease-sanft ml-0.5"
            strokeWidth={2}
          />
        </div>
      </div>

      {kampagne.beschreibung && (
        <p className="text-xs ax-text-tertiaer mb-4 line-clamp-1">{kampagne.beschreibung}</p>
      )}

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${status.farbe}`}>
          {status.text}
        </span>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${quellenFarbe}`}>
          {triggerBezeichnungen[kampagne.triggerTyp] || kampagne.triggerTyp}
        </span>
      </div>

      {kampagne.statistiken && (
        <div className="grid grid-cols-3 gap-3 pt-4" style={{ borderTop: '1px solid var(--rahmen-leicht)' }}>
          <div>
            <p className="ax-label mb-1">Gesamt</p>
            <p className="text-xl font-bold ax-titel tabular-nums leading-none">
              {kampagne.statistiken.gesamtLeads}
            </p>
          </div>
          <div>
            <p className="ax-label mb-1">Heute</p>
            <p className="text-xl font-bold ax-titel tabular-nums leading-none">
              {kampagne.statistiken.leadsHeute}
            </p>
          </div>
          <div>
            <p className="ax-label mb-1">Conversion</p>
            <p
              className="text-xl font-bold tabular-nums leading-none"
              style={{ color: 'var(--axano-orange)' }}
            >
              {kampagne.statistiken.conversionRate}
              <span className="text-sm font-semibold ml-0.5" style={{ color: 'var(--axano-orange)' }}>%</span>
            </p>
          </div>
        </div>
      )}
    </Link>
  );
}
