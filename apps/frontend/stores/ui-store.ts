import { create } from 'zustand';

interface UiZustand {
  darkMode: boolean;
  darkModeUmschalten: () => void;
  darkModeInitialisieren: () => void;
}

export const useUiStore = create<UiZustand>((set) => ({
  darkMode: false,
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
