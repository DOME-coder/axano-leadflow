import { create } from 'zustand';

interface BenutzerDaten {
  id: string;
  email: string;
  vorname: string;
  nachname: string;
  rolle: 'admin' | 'mitarbeiter';
}

interface AuthZustand {
  benutzer: BenutzerDaten | null;
  istAuthentifiziert: boolean;
  benutzerSetzen: (benutzer: BenutzerDaten) => void;
  abmelden: () => void;
}

export const useAuthStore = create<AuthZustand>((set) => ({
  benutzer: null,
  istAuthentifiziert: false,
  benutzerSetzen: (benutzer) => set({ benutzer, istAuthentifiziert: true }),
  abmelden: () => {
    localStorage.removeItem('access_token');
    set({ benutzer: null, istAuthentifiziert: false });
  },
}));
