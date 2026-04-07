'use client';

import { useEffect, useState, useRef } from 'react';
import { Search, Sun, Moon, User } from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

interface SuchErgebnis {
  id: string;
  vorname?: string;
  nachname?: string;
  email?: string;
  telefon?: string;
  status: string;
  kampagneId: string;
  kampagne?: { name: string };
}

export function Kopfzeile() {
  const { darkMode, darkModeUmschalten, darkModeInitialisieren } = useUiStore();
  const [suchBegriff, setSuchBegriff] = useState('');
  const [ergebnisse, setErgebnisse] = useState<SuchErgebnis[]>([]);
  const [zeigeSuche, setZeigeSuche] = useState(false);
  const [laed, setLaed] = useState(false);
  const suchRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    darkModeInitialisieren();
  }, [darkModeInitialisieren]);

  // Klick außerhalb schließt Suchergebnisse
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suchRef.current && !suchRef.current.contains(e.target as Node)) {
        setZeigeSuche(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suchen = (text: string) => {
    setSuchBegriff(text);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (text.trim().length < 2) {
      setErgebnisse([]);
      setZeigeSuche(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLaed(true);
      try {
        const { data } = await apiClient.get(`/leads?suche=${encodeURIComponent(text.trim())}&pro_seite=8`);
        setErgebnisse(data.daten?.eintraege || []);
        setZeigeSuche(true);
      } catch {
        setErgebnisse([]);
      }
      setLaed(false);
    }, 300);
  };

  return (
    <header className="h-14 ax-karte border-b ax-rahmen-leicht flex items-center justify-between px-6 rounded-none">
      {/* Globale Lead-Suche */}
      <div className="relative w-80" ref={suchRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ax-text-tertiaer" />
        <input
          type="text"
          value={suchBegriff}
          onChange={(e) => suchen(e.target.value)}
          onFocus={() => suchBegriff.trim().length >= 2 && setZeigeSuche(true)}
          placeholder="Leads suchen (Name, E-Mail, Telefon)..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg ax-eingabe ax-karte-erhoeht transition-all"
        />

        {/* Suchergebnisse Dropdown */}
        {zeigeSuche && (
          <div className="absolute top-full left-0 right-0 mt-1 ax-karte rounded-lg shadow-lg border ax-rahmen-leicht max-h-80 overflow-y-auto z-50">
            {laed ? (
              <div className="p-3 text-xs ax-text-tertiaer text-center">Suche läuft...</div>
            ) : ergebnisse.length === 0 ? (
              <div className="p-3 text-xs ax-text-tertiaer text-center">Keine Ergebnisse für "{suchBegriff}"</div>
            ) : (
              ergebnisse.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/kampagnen/${lead.kampagneId}/leads`}
                  onClick={() => { setZeigeSuche(false); setSuchBegriff(''); }}
                  className="flex items-center gap-3 px-3 py-2.5 ax-hover transition-all border-b ax-rahmen-leicht last:border-0"
                >
                  <div className="w-7 h-7 rounded-full bg-axano-orange/10 text-axano-orange flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium ax-titel truncate">
                      {[lead.vorname, lead.nachname].filter(Boolean).join(' ') || 'Unbekannt'}
                    </p>
                    <p className="text-xs ax-text-tertiaer truncate">
                      {lead.email || lead.telefon || '—'} · {lead.kampagne?.name || ''}
                    </p>
                  </div>
                  <span className="text-xs ax-text-tertiaer flex-shrink-0">{lead.status}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* Dark Mode Toggle */}
      <button
        onClick={darkModeUmschalten}
        className="p-2 rounded-lg ax-text-sekundaer ax-hover hover:text-[var(--text)] transition-all"
        title={darkMode ? 'Light Mode' : 'Dark Mode'}
      >
        {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </header>
  );
}
