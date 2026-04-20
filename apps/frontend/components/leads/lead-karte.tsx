'use client';

import { useDraggable } from '@dnd-kit/core';
import { Facebook, Globe, Mail, MessageSquare, FileText, type LucideIcon } from 'lucide-react';
import type { Lead } from '@/lib/typen';

interface LeadKarteProps {
  lead: Lead;
  akzentFarbe?: string;
  onClick?: () => void;
}

const triggerBezeichnungen: Record<string, string> = {
  facebook_lead_ads: 'Facebook',
  webhook: 'Webhook',
  email: 'E-Mail',
  whatsapp: 'WhatsApp',
  webformular: 'Formular',
};

const triggerIcons: Record<string, LucideIcon> = {
  facebook_lead_ads: Facebook,
  webhook: Globe,
  email: Mail,
  whatsapp: MessageSquare,
  webformular: FileText,
};

function zeitVon(datum: string): string {
  const diff = Date.now() - new Date(datum).getTime();
  const minuten = Math.floor(diff / 60000);
  if (minuten < 1) return 'Gerade eben';
  if (minuten < 60) return `vor ${minuten} Min.`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `vor ${stunden} Std.`;
  const tage = Math.floor(stunden / 24);
  if (tage < 7) return `vor ${tage} Tag${tage > 1 ? 'en' : ''}`;
  return new Date(datum).toLocaleDateString('de-DE');
}

export function LeadKarte({ lead, akzentFarbe, onClick }: LeadKarteProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style: React.CSSProperties = {
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
  };

  const QuelleIcon = lead.quelle ? triggerIcons[lead.quelle] : null;
  const initiale = (lead.vorname?.[0] || lead.nachname?.[0] || '?').toUpperCase();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`ax-karte-interaktiv rounded-xl cursor-pointer group ax-fokus-ring relative overflow-hidden ${
        isDragging ? 'opacity-60 rotate-1' : ''
      }`}
      tabIndex={0}
      role="button"
      aria-label={`Lead ${[lead.vorname, lead.nachname].filter(Boolean).join(' ') || 'Unbekannt'}`}
    >
      {/* Farbiger Left-Accent-Streifen – full height */}
      {akzentFarbe && (
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ backgroundColor: akzentFarbe }}
        />
      )}

      <div className="p-4 pl-[18px]">
        {/* Kopfzeile mit Avatar */}
        <div className="flex items-start gap-3 mb-2">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ax-titel"
            style={{
              backgroundColor: 'var(--karte-erhoeht)',
              border: '1px solid var(--rahmen-leicht)',
            }}
            aria-hidden
          >
            {initiale}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold ax-titel text-sm truncate leading-tight">
              {[lead.vorname, lead.nachname].filter(Boolean).join(' ') || 'Unbekannt'}
            </p>
            {lead.email && (
              <p className="text-[11px] ax-text-sekundaer mt-0.5 truncate">{lead.email}</p>
            )}
          </div>
          {lead.istDuplikat && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm flex-shrink-0"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#b45309',
                border: '1px solid rgba(245, 158, 11, 0.28)',
              }}
            >
              Dupl.
            </span>
          )}
        </div>

        {/* Telefon */}
        {lead.telefon && (
          <p className="text-xs ax-text-sekundaer mb-2.5 tabular-nums tracking-tight ml-12">
            {lead.telefon}
          </p>
        )}

        {/* Metadaten-Zeile */}
        <div className="flex items-center justify-between gap-2 ml-12">
          {lead.quelle && (
            <div className="flex items-center gap-1.5 min-w-0">
              {QuelleIcon && (
                <QuelleIcon className="w-3 h-3 ax-text-tertiaer flex-shrink-0" strokeWidth={2.2} />
              )}
              <span className="text-[11px] font-medium ax-text-sekundaer truncate">
                {triggerBezeichnungen[lead.quelle] || lead.quelle}
              </span>
            </div>
          )}
          <span className="text-[11px] ax-text-tertiaer flex-shrink-0 tabular-nums">
            {zeitVon(lead.erstelltAm)}
          </span>
        </div>

        {/* Zugewiesener Mitarbeiter */}
        {lead.zugewiesenAn && (
          <div
            className="flex items-center gap-2 mt-3 pt-2.5 ml-12"
            style={{ borderTop: '1px solid var(--rahmen-leicht)' }}
          >
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
              style={{
                backgroundColor: 'var(--axano-sky-blue)',
                color: 'var(--axano-primaer)',
              }}
            >
              {lead.zugewiesenAn.name.charAt(0)}
            </div>
            <span className="text-[11px] ax-text-sekundaer font-medium truncate">
              {lead.zugewiesenAn.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
