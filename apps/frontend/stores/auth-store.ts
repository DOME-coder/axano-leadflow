import { create } from 'zustand';

interface BenutzerDaten {
  id: string;
  email: string;
  vorname: string;
  nachname: string;
  rolle: 'admin' | 'mitarbeiter' | 'kunde';
  /** Nur bei Rolle "kunde" gesetzt */
  kundeId?: string | null;
  /** Nur bei Rolle "kunde" gesetzt — Name des zugeordneten Kunden (fuer Anzeige) */
  kunde?: { id: string; name: string } | null;
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
