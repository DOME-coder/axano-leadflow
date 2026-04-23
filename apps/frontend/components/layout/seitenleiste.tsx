'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Megaphone,
  Users,
  FileText,
  BarChart2,
  Calendar,
  Settings,
  LogOut,
  Building2,
  BookOpen,
  Plug,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { benutzeKunden } from '@/hooks/benutze-kunden';

const navElementeTeam = [
  { bezeichnung: 'Dashboard', pfad: '/dashboard', icon: LayoutDashboard },
  { bezeichnung: 'Kampagnen', pfad: '/kampagnen', icon: Megaphone },
  { bezeichnung: 'Kunden', pfad: '/kunden', icon: Building2 },
  { bezeichnung: 'Templates', pfad: '/templates', icon: FileText },
  { bezeichnung: 'Prompt-Bibliothek', pfad: '/prompt-bibliothek', icon: BookOpen },
  { bezeichnung: 'Analytics', pfad: '/analytics', icon: BarChart2 },
  { bezeichnung: 'Kalender', pfad: '/kalender', icon: Calendar },
  { bezeichnung: 'Einstellungen', pfad: '/einstellungen', icon: Settings },
];

const navElementeKunde = [
  { bezeichnung: 'Meine Integrationen', pfad: '/meine-integrationen', icon: Plug },
];

export function Seitenleiste() {
  const pathname = usePathname();
  const router = useRouter();
  const { benutzer, abmelden } = useAuthStore();
  const { ausgewaehlterKundeId, kundeSetzen } = useUiStore();
  // Im Dropdown muessen immer ALLE Kunden stehen, damit der Admin wechseln kann.
  // Deshalb den globalen Filter hier bewusst ignorieren.
  const { data: kunden } = benutzeKunden({ ignoriereGlobalenFilter: true });

  const handleAbmelden = () => {
    abmelden();
    router.push('/anmelden');
  };

  const initialen = benutzer
    ? `${benutzer.vorname[0]}${benutzer.nachname[0]}`.toUpperCase()
    : 'AX';

  const anzeigeName = benutzer
    ? `${benutzer.vorname} ${benutzer.nachname.charAt(0)}.`
    : 'Admin';

  const istKunde = benutzer?.rolle === 'kunde';
  const navElemente = istKunde ? navElementeKunde : navElementeTeam;
  const rolleAnzeige = istKunde
    ? benutzer?.kunde?.name || 'Kunde'
    : benutzer?.rolle === 'admin'
    ? 'Administrator'
    : 'Mitarbeiter';

  return (
    <aside
      className="relative w-60 min-h-screen flex flex-col"
      style={{
        background:
          'linear-gradient(180deg, #1a2b4c 0%, #1a2b4c 35%, #1d3154 100%)',
      }}
    >
      {/* Feiner vertikaler Rand rechts für Tiefe */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent pointer-events-none" />

      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/[0.07]">
        <div className="flex items-baseline gap-1.5">
          <img src="/logo.png" alt="Axano" className="h-6 brightness-0 invert" />
          <span className="text-white/40 text-[10px] font-semibold tracking-[0.18em] uppercase">
            LeadFlow
          </span>
        </div>
      </div>

      {/* Kunden-Filter (nur fuer Axano-Team) */}
      {!istKunde && kunden?.eintraege && kunden.eintraege.length > 0 && (
        <div className="px-3 pt-4 pb-2">
          <label className="text-white/40 text-[10px] font-semibold uppercase tracking-[0.14em] px-2 mb-1.5 block">
            Kunde
          </label>
          <div className="relative">
            <select
              value={ausgewaehlterKundeId || ''}
              onChange={(e) => kundeSetzen(e.target.value || null)}
              className="w-full px-3 py-2 pr-8 text-sm rounded-lg bg-white/[0.06] text-white border border-white/[0.07] hover:bg-white/[0.10] hover:border-white/[0.12] focus:border-axano-orange focus:ring-2 focus:ring-axano-orange/20 focus:outline-none appearance-none cursor-pointer transition-all duration-200 ease-sanft"
            >
              <option value="" className="text-gray-900">Alle Kunden</option>
              {kunden.eintraege.map((k) => (
                <option key={k.id} value={k.id} className="text-gray-900">{k.name}</option>
              ))}
            </select>
            <svg
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navElemente.map((element) => {
          const aktiv = pathname?.startsWith(element.pfad);
          return (
            <Link
              key={element.pfad}
              href={element.pfad}
              className={`group relative flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-sanft ${
                aktiv
                  ? 'text-white bg-white/[0.08]'
                  : 'text-white/65 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {/* Orange-Akzent-Linie links für aktiven Zustand */}
              {aktiv && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-axano-orange"
                  style={{ boxShadow: '0 0 12px rgba(255, 128, 73, 0.5)' }}
                />
              )}
              <element.icon
                className={`flex-shrink-0 transition-colors duration-200 ${
                  aktiv ? 'text-axano-orange' : 'text-white/55 group-hover:text-white'
                }`}
                style={{ width: 17, height: 17 }}
                strokeWidth={2}
              />
              <span className="truncate">{element.bezeichnung}</span>
            </Link>
          );
        })}
      </nav>

      {/* Benutzer-Panel */}
      <div className="p-3 border-t border-white/[0.07]">
        <div
          className="rounded-xl p-3 mb-2"
          style={{
            background: 'rgba(255, 255, 255, 0.035)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #ff8049 0%, #ea6c37 100%)',
                boxShadow: '0 2px 8px rgba(255, 128, 73, 0.3)',
              }}
            >
              {initialen}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{anzeigeName}</p>
              <p className="text-white/50 text-[11px] font-medium truncate tracking-wide">{rolleAnzeige}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleAbmelden}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-white/50 hover:bg-white/[0.04] hover:text-white transition-all duration-200 ease-sanft w-full"
        >
          <LogOut className="w-4 h-4" strokeWidth={2} />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
