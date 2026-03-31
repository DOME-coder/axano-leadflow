'use client';

import { useEffect } from 'react';
import { Bell, Search, Sun, Moon } from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';

export function Kopfzeile() {
  const { darkMode, darkModeUmschalten, darkModeInitialisieren } = useUiStore();

  useEffect(() => {
    darkModeInitialisieren();
  }, [darkModeInitialisieren]);

  return (
    <header className="h-14 ax-karte border-b ax-rahmen-leicht flex items-center justify-between px-6 rounded-none">
      {/* Suchfeld */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ax-text-tertiaer" />
        <input
          type="text"
          placeholder="Suchen..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg ax-eingabe ax-karte-erhoeht transition-all"
        />
      </div>

      {/* Aktionen */}
      <div className="flex items-center gap-2">
        {/* Dark Mode Toggle */}
        <button
          onClick={darkModeUmschalten}
          className="p-2 rounded-lg ax-text-sekundaer ax-hover hover:text-[var(--text)] transition-all"
          title={darkMode ? 'Light Mode' : 'Dark Mode'}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Benachrichtigungen */}
        <button className="relative p-2 rounded-lg ax-text-sekundaer ax-hover hover:text-[var(--text)] transition-all">
          <Bell className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
