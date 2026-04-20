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
    <header className="relative h-16 flex items-center justify-between px-7" style={{ backgroundColor: 'var(--karte)' }}>
      {/* Gradient-Fade-Border statt harter Linie */}
      <div
        className="absolute left-0 right-0 bottom-0 h-px pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, var(--rahmen) 15%, var(--rahmen) 85%, transparent 100%)',
        }}
      />

      {/* Globale Lead-Suche */}
      <div className="relative w-96 max-w-[42vw]" ref={suchRef}>
        <Search
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
            zeigeSuche || suchBegriff ? 'text-axano-orange' : 'ax-text-tertiaer'
          }`}
          strokeWidth={2}
        />
        <input
          type="text"
          value={suchBegriff}
          onChange={(e) => suchen(e.target.value)}
          onFocus={() => suchBegriff.trim().length >= 2 && setZeigeSuche(true)}
          placeholder="Leads suchen (Name, E-Mail, Telefon)..."
          className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl ax-eingabe ax-karte-erhoeht"
        />

        {/* Suchergebnisse Dropdown */}
        {zeigeSuche && (
          <div
            className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden z-50 animate-einblenden-nach-oben"
            style={{
              backgroundColor: 'var(--karte)',
              border: '1px solid var(--rahmen-leicht)',
              boxShadow: 'var(--schatten-xl)',
              maxHeight: '24rem',
              overflowY: 'auto',
            }}
          >
            {laed ? (
              <div className="p-5 text-xs ax-text-tertiaer text-center">Suche läuft…</div>
            ) : ergebnisse.length === 0 ? (
              <div className="p-5 text-xs ax-text-tertiaer text-center">
                Keine Ergebnisse für „{suchBegriff}"
              </div>
            ) : (
              ergebnisse.map((lead, idx) => (
                <Link
                  key={lead.id}
                  href={`/kampagnen/${lead.kampagneId}/leads`}
                  onClick={() => { setZeigeSuche(false); setSuchBegriff(''); }}
                  className={`flex items-center gap-3 px-4 py-3 ax-hover transition-all ${
                    idx > 0 ? 'border-t' : ''
                  } ax-rahmen-leicht`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      backgroundColor: 'var(--akzent-orange-sanft)',
                      color: 'var(--axano-orange)',
                    }}
                  >
                    <User className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold ax-titel truncate">
                      {[lead.vorname, lead.nachname].filter(Boolean).join(' ') || 'Unbekannt'}
                    </p>
                    <p className="text-xs ax-text-tertiaer truncate">
                      {lead.email || lead.telefon || '—'} · {lead.kampagne?.name || ''}
                    </p>
                  </div>
                  <span className="ax-label flex-shrink-0">{lead.status}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* Dark Mode Toggle */}
      <button
        onClick={darkModeUmschalten}
        className="relative p-2.5 rounded-xl ax-text-sekundaer ax-hover hover:text-[var(--text-titel)] transition-all duration-250 ease-sanft group"
        title={darkMode ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}
        aria-label={darkMode ? 'Light Mode aktivieren' : 'Dark Mode aktivieren'}
      >
        <div className="relative w-5 h-5">
          <Sun
            className="absolute inset-0 w-5 h-5 transition-all duration-350 ease-sanft"
            strokeWidth={2}
            style={{
              opacity: darkMode ? 1 : 0,
              transform: darkMode ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.6)',
            }}
          />
          <Moon
            className="absolute inset-0 w-5 h-5 transition-all duration-350 ease-sanft"
            strokeWidth={2}
            style={{
              opacity: darkMode ? 0 : 1,
              transform: darkMode ? 'rotate(90deg) scale(0.6)' : 'rotate(0deg) scale(1)',
            }}
          />
        </div>
      </button>
    </header>
  );
}
