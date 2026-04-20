'use client';

import { useDroppable } from '@dnd-kit/core';
import { Inbox } from 'lucide-react';
import { LeadKarte } from './lead-karte';
import type { Lead } from '@/lib/typen';

interface KanbanSpalteProps {
  spalte: string;
  leads: Lead[];
  onLeadKlick: (lead: Lead) => void;
}

// Farb-Mapping für Spalten-Unterstrich + Akzent – passt zum Status-System
const spaltenFarbe: Record<string, string> = {
  'Neu': '#3b82f6',
  'Anruf läuft': '#f59e0b',
  'Voicemail': '#f97316',
  'Follow-up': '#a855f7',
  'Nicht erreichbar': '#ef4444',
  'Falsche Nummer': '#e11d48',
  'Nicht interessiert': '#94a3b8',
  'Termin gebucht': '#22c55e',
  'Hung Up': '#d97706',
  'Disconnected': '#64748b',
  'WhatsApp erhalten': '#10b981',
};

function farbeFuer(status: string): string {
  if (spaltenFarbe[status]) return spaltenFarbe[status];
  if (status.startsWith('Attempt #')) return '#06b6d4';
  return '#94a3b8';
}

export function KanbanSpalte({ spalte, leads, onLeadKlick }: KanbanSpalteProps) {
  const { setNodeRef, isOver } = useDroppable({ id: spalte });
  const farbe = farbeFuer(spalte);

  return (
    <div className="flex-shrink-0 w-72 flex flex-col">
      {/* Spalten-Header */}
      <div className="mb-3 px-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: farbe }}
              aria-hidden
            />
            <h3 className="text-sm font-semibold ax-titel tracking-tight">
              {spalte}
            </h3>
          </div>
          <span className="ax-zahl text-xs ax-text-tertiaer font-semibold tabular-nums">
            {leads.length}
          </span>
        </div>
        {/* Dünner farbiger Unterstrich als Spalten-Akzent */}
        <div
          className="mt-2 h-[2px] rounded-full"
          style={{
            background: `linear-gradient(90deg, ${farbe} 0%, ${farbe}00 100%)`,
            opacity: 0.55,
          }}
        />
      </div>

      {/* Drop-Zone mit Lead-Karten */}
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2.5 min-h-[240px] rounded-xl p-1.5 transition-all duration-250 ease-sanft`}
        style={{
          backgroundColor: isOver ? 'var(--akzent-orange-sanft)' : 'transparent',
          boxShadow: isOver ? 'inset 0 0 0 2px var(--akzent-orange-rand)' : 'none',
        }}
      >
        {leads.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-32 rounded-xl gap-1.5"
            style={{
              border: '1.5px dashed var(--rahmen-leicht)',
            }}
          >
            <Inbox className="w-5 h-5 ax-text-tertiaer" strokeWidth={1.75} />
            <p className="text-xs ax-text-tertiaer font-medium">Noch keine Leads</p>
          </div>
        ) : (
          leads.map((lead, idx) => (
            <div
              key={lead.id}
              className="animate-einblenden-nach-oben"
              style={{
                animationDelay: `${Math.min(idx * 35, 350)}ms`,
                animationFillMode: 'backwards',
              }}
            >
              <LeadKarte
                lead={lead}
                akzentFarbe={farbe}
                onClick={() => onLeadKlick(lead)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
