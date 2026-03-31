'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, Plug, Users, User } from 'lucide-react';

const tabs = [
  { bezeichnung: 'Integrationen', pfad: '/einstellungen/integrationen', icon: Plug },
  { bezeichnung: 'Benutzer', pfad: '/einstellungen/benutzer', icon: Users },
  { bezeichnung: 'Profil', pfad: '/einstellungen/profil', icon: User },
];

export default function EinstellungenSeite() {
  const pathname = usePathname();

  return (
    <div className="animate-einblenden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold ax-titel">Einstellungen</h1>
        <p className="text-sm ax-text-sekundaer mt-1">
          System- und Integrationseinstellungen
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <Link
            key={tab.pfad}
            href={tab.pfad}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              pathname === tab.pfad
                ? 'bg-axano-primaer text-white'
                : 'ax-karte ax-text ax-hover'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.bezeichnung}
          </Link>
        ))}
      </div>

      <div className="ax-karte rounded-xl p-12 text-center">
        <Settings className="w-12 h-12 text-axano-sky-blue mx-auto mb-3" />
        <h3 className="text-lg font-semibold ax-titel mb-1">
          Einstellungsbereich wählen
        </h3>
        <p className="text-sm ax-text-sekundaer">
          Wählen Sie einen Bereich oben, um die Einstellungen zu konfigurieren.
        </p>
      </div>
    </div>
  );
}
