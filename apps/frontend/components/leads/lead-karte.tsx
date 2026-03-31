'use client';

import { useDraggable } from '@dnd-kit/core';
import { quellenFarben } from '@/lib/typen';
import type { Lead } from '@/lib/typen';

interface LeadKarteProps {
  lead: Lead;
  onClick?: () => void;
}

const triggerBezeichnungen: Record<string, string> = {
  facebook_lead_ads: 'Facebook',
  webhook: 'Webhook',
  email: 'E-Mail',
  whatsapp: 'WhatsApp',
  webformular: 'Formular',
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

export function LeadKarte({ lead, onClick }: LeadKarteProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const quellenFarbe = quellenFarben[lead.quelle || ''] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`ax-karte rounded-xl p-4 cursor-pointer hover:border-axano-orange/50 hover:shadow-sm transition-all group ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
    >
      {/* Kopfzeile */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0">
          <p className="font-semibold ax-titel text-sm truncate">
            {[lead.vorname, lead.nachname].filter(Boolean).join(' ') || 'Unbekannt'}
          </p>
          {lead.email && (
            <p className="text-xs ax-text-sekundaer mt-0.5 truncate">{lead.email}</p>
          )}
        </div>
        {lead.istDuplikat && (
          <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">
            Duplikat
          </span>
        )}
      </div>

      {/* Telefon */}
      {lead.telefon && (
        <p className="text-xs ax-text-sekundaer mb-2 font-mono">{lead.telefon}</p>
      )}

      {/* Metadaten */}
      <div className="flex items-center gap-2 flex-wrap">
        {lead.quelle && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${quellenFarbe}`}>
            {triggerBezeichnungen[lead.quelle] || lead.quelle}
          </span>
        )}
        <span className="text-xs ax-text-tertiaer">
          {zeitVon(lead.erstelltAm)}
        </span>
      </div>

      {/* Zugewiesener Mitarbeiter */}
      {lead.zugewiesenAn && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t ax-rahmen-leicht">
          <div className="w-5 h-5 rounded-full bg-axano-sky-blue/50 dark:bg-axano-sky-blue/20 flex items-center justify-center text-[10px] font-bold text-[var(--titel)]">
            {lead.zugewiesenAn.name.charAt(0)}
          </div>
          <span className="text-xs ax-text-sekundaer">{lead.zugewiesenAn.name}</span>
        </div>
      )}
    </div>
  );
}
