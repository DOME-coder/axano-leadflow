'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface LeerZustandProps {
  icon: LucideIcon;
  titel: string;
  beschreibung?: string;
  aktion?: ReactNode;
  kompakt?: boolean;
}

/**
 * Wiederverwendbarer leerer Zustand – großes gedecktes Icon + freundlicher Text + optionaler CTA.
 * Für Seiten ohne Daten oder Listen ohne Einträge.
 */
export function LeerZustand({ icon: Icon, titel, beschreibung, aktion, kompakt = false }: LeerZustandProps) {
  return (
    <div
      className={`ax-karte rounded-2xl text-center flex flex-col items-center ${
        kompakt ? 'p-10' : 'p-14'
      }`}
    >
      <div
        className="mb-4 rounded-2xl p-4 flex items-center justify-center"
        style={{
          backgroundColor: 'var(--karte-erhoeht)',
          border: '1px solid var(--rahmen-leicht)',
        }}
      >
        <Icon
          className={kompakt ? 'w-7 h-7' : 'w-9 h-9'}
          strokeWidth={1.75}
          style={{ color: 'var(--text-sekundaer)' }}
        />
      </div>
      <h3 className={`ax-titel font-bold mb-1.5 ${kompakt ? 'text-base' : 'text-lg'}`}>
        {titel}
      </h3>
      {beschreibung && (
        <p className="text-sm ax-text-sekundaer max-w-sm leading-relaxed text-balance">
          {beschreibung}
        </p>
      )}
      {aktion && <div className="mt-5">{aktion}</div>}
    </div>
  );
}
