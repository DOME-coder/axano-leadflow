import { create } from 'zustand';

interface UiZustand {
  darkMode: boolean;
  darkModeUmschalten: () => void;
  darkModeInitialisieren: () => void;
  ausgewaehlterKundeId: string | null;
  kundeSetzen: (kundeId: string | null) => void;
}

export const useUiStore = create<UiZustand>((set) => ({
  darkMode: false,
  ausgewaehlterKundeId: typeof window !== 'undefined' ? localStorage.getItem('axano-kunde-filter') : null,
  kundeSetzen: (kundeId) => {
    if (typeof window !== 'undefined') {
      if (kundeId) {
        localStorage.setItem('axano-kunde-filter', kundeId);
      } else {
        localStorage.removeItem('axano-kunde-filter');
      }
    }
    set({ ausgewaehlterKundeId: kundeId });
  },
  darkModeUmschalten: () => {
    set((state) => {
      const neuerWert = !state.darkMode;
      if (typeof window !== 'undefined') {
        localStorage.setItem('axano-dark-mode', String(neuerWert));
        document.documentElement.classList.toggle('dark', neuerWert);
      }
      return { darkMode: neuerWert };
    });
  },
  darkModeInitialisieren: () => {
    if (typeof window === 'undefined') return;
    const gespeichert = localStorage.getItem('axano-dark-mode');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const darkMode = gespeichert ? gespeichert === 'true' : systemDark;
    document.documentElement.classList.toggle('dark', darkMode);
    set({ darkMode });
  },
}));
