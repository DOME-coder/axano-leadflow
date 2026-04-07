'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Megaphone,
  Users,
  FileText,
  BarChart2,
  Zap,
  Calendar,
  Settings,
  LogOut,
  Building2,
  BookOpen,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { benutzeKunden } from '@/hooks/benutze-kunden';

const navElemente = [
  { bezeichnung: 'Dashboard', pfad: '/dashboard', icon: LayoutDashboard },
  { bezeichnung: 'Kampagnen', pfad: '/kampagnen', icon: Megaphone },
  { bezeichnung: 'Kunden', pfad: '/kunden', icon: Building2 },
  { bezeichnung: 'Automatisierungen', pfad: '/automatisierungen', icon: Zap },
  { bezeichnung: 'Templates', pfad: '/templates', icon: FileText },
  { bezeichnung: 'Prompt-Bibliothek', pfad: '/prompt-bibliothek', icon: BookOpen },
  { bezeichnung: 'Analytics', pfad: '/analytics', icon: BarChart2 },
  { bezeichnung: 'Kalender', pfad: '/kalender', icon: Calendar },
  { bezeichnung: 'Einstellungen', pfad: '/einstellungen', icon: Settings },
];

export function Seitenleiste() {
  const pathname = usePathname();
  const router = useRouter();
  const { benutzer, abmelden } = useAuthStore();
  const { ausgewaehlterKundeId, kundeSetzen } = useUiStore();
  const { data: kunden } = benutzeKunden();

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

  const rolleAnzeige = benutzer?.rolle === 'admin' ? 'Administrator' : 'Mitarbeiter';

  return (
    <aside className="w-60 min-h-screen bg-axano-primaer flex flex-col">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <img src="/logo.png" alt="Axano" className="h-7 brightness-0 invert" />
        <span className="text-axano-sky-blue/60 text-[10px] font-medium ml-0.5 tracking-wider uppercase">LeadFlow</span>
      </div>

      {/* Kunden-Filter */}
      {kunden?.eintraege && kunden.eintraege.length > 0 && (
        <div className="px-3 pt-3 pb-1">
          <label className="text-axano-sky-blue/40 text-[10px] font-medium uppercase tracking-wider px-1 mb-1 block">Kunde</label>
          <select
            value={ausgewaehlterKundeId || ''}
            onChange={(e) => kundeSetzen(e.target.value || null)}
            className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 text-white border border-white/10 focus:border-axano-orange focus:outline-none appearance-none cursor-pointer"
          >
            <option value="" className="text-gray-900">Alle Kunden</option>
            {kunden.eintraege.map((k) => (
              <option key={k.id} value={k.id} className="text-gray-900">{k.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navElemente.map((element) => {
          const aktiv = pathname?.startsWith(element.pfad);
          return (
            <Link
              key={element.pfad}
              href={element.pfad}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                aktiv
                  ? 'bg-white/15 text-white'
                  : 'text-axano-sky-blue/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <element.icon className="w-4 h-4" />
              {element.bezeichnung}
            </Link>
          );
        })}
      </nav>

      {/* Benutzer */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-axano-orange flex items-center justify-center text-white text-xs font-bold">
            {initialen}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{anzeigeName}</p>
            <p className="text-axano-sky-blue/60 text-xs truncate">{rolleAnzeige}</p>
          </div>
        </div>
        <button
          onClick={handleAbmelden}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-axano-sky-blue/50 hover:bg-white/10 hover:text-white transition-all w-full"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>
      </div>
    </aside>
  );
}
