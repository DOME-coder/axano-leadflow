'use client';

import { useDroppable } from '@dnd-kit/core';
import { LeadKarte } from './lead-karte';
import { statusFarbeErmitteln } from '@/lib/typen';
import type { Lead } from '@/lib/typen';

interface KanbanSpalteProps {
  spalte: string;
  leads: Lead[];
  onLeadKlick: (lead: Lead) => void;
}

export function KanbanSpalte({ spalte, leads, onLeadKlick }: KanbanSpalteProps) {
  const { setNodeRef, isOver } = useDroppable({ id: spalte });

  const farbe = statusFarbeErmitteln(spalte);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 flex flex-col rounded-xl transition-colors ${
        isOver ? 'bg-axano-orange/5' : ''
      }`}
    >
      {/* Spalten-Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${farbe}`}>
            {spalte}
          </span>
          <span className="text-xs ax-text-tertiaer font-medium">
            {leads.length}
          </span>
        </div>
      </div>

      {/* Lead-Karten */}
      <div className={`flex-1 space-y-2 min-h-[200px] rounded-xl p-1 transition-all ${
        isOver ? 'ring-2 ring-axano-orange/30 ring-dashed' : ''
      }`}>
        {leads.length === 0 ? (
          <div className="flex items-center justify-center h-24 border-2 border-dashed ax-rahmen-leicht rounded-xl">
            <p className="text-xs ax-text-tertiaer">Keine Leads</p>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadKarte
              key={lead.id}
              lead={lead}
              onClick={() => onLeadKlick(lead)}
            />
          ))
        )}
      </div>
    </div>
  );
}
