'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

type ZustandStatus = 'pruefe' | 'gueltig' | 'ungueltig';

interface EinladungsDaten {
  email: string;
  vorname: string;
  kundeName: string | null;
}

export default function EinladungAnnehmenSeite({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { benutzerSetzen } = useAuthStore();
  const [status, setStatus] = useState<ZustandStatus>('pruefe');
  const [einladung, setEinladung] = useState<EinladungsDaten | null>(null);
  const [fehler, setFehler] = useState('');
  const [passwort, setPasswort] = useState('');
  const [passwortWiederholen, setPasswortWiederholen] = useState('');
  const [passwortSichtbar, setPasswortSichtbar] = useState(false);
  const [sendet, setSendet] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const antwort = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/einladung-pruefen?token=${encodeURIComponent(params.token)}`,
        );
        const ergebnis = await antwort.json();
        if (abgebrochen) return;
        if (!ergebnis.erfolg) {
          setStatus('ungueltig');
          setFehler(ergebnis.fehler || 'Einladung ist ungueltig oder abgelaufen');
          return;
        }
        setEinladung(ergebnis.daten);
        setStatus('gueltig');
      } catch {
        if (abgebrochen) return;
        setStatus('ungueltig');
        setFehler('Verbindung zum Server fehlgeschlagen');
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [params.token]);

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault();
    setFehler('');

    if (passwort.length < 10) {
      setFehler('Das Passwort muss mindestens 10 Zeichen lang sein');
      return;
    }
    if (passwort !== passwortWiederholen) {
      setFehler('Die beiden Passwörter stimmen nicht überein');
      return;
    }

    setSendet(true);
    try {
      const antwort = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/einladung-annehmen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: params.token, passwort }),
      });
      const ergebnis = await antwort.json();
      if (!ergebnis.erfolg) {
        setFehler(ergebnis.fehler || 'Einladung konnte nicht eingeloest werden');
        return;
      }
      localStorage.setItem('access_token', ergebnis.daten.access_token);
      benutzerSetzen(ergebnis.daten.benutzer);
      router.push('/meine-integrationen');
    } catch {
      setFehler('Verbindung zum Server fehlgeschlagen');
    } finally {
      setSendet(false);
    }
  };

  if (status === 'pruefe') {
    return (
      <div className="w-full max-w-md animate-einblenden">
        <div className="ax-karte rounded-xl p-8 text-center shadow-sm">
          <div className="w-8 h-8 border-2 border-axano-orange/30 border-t-axano-orange rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm ax-text-sekundaer">Einladung wird geprüft…</p>
        </div>
      </div>
    );
  }

  if (status === 'ungueltig') {
    return (
      <div className="w-full max-w-md animate-einblenden">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Axano" className="h-10 mx-auto mb-2 dark:brightness-0 dark:invert" />
          <p className="text-xs ax-text-sekundaer font-medium tracking-wider uppercase">LeadFlow Plattform</p>
        </div>
        <div className="ax-karte rounded-xl p-8 shadow-sm">
          <h2 className="text-xl font-bold ax-titel mb-2">Einladung ungültig</h2>
          <p className="text-sm ax-text-sekundaer mb-4">{fehler}</p>
          <p className="text-sm ax-text-sekundaer">
            Bitte wende dich an das Axano-Team, um eine neue Einladung zu erhalten.
          </p>
          <Link
            href="/anmelden"
            className="mt-6 block text-center bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm"
          >
            Zur Anmeldung
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md animate-einblenden">
      <div className="text-center mb-8">
        <img src="/logo.png" alt="Axano" className="h-10 mx-auto mb-2 dark:brightness-0 dark:invert" />
        <p className="text-xs ax-text-sekundaer font-medium tracking-wider uppercase">LeadFlow Plattform</p>
      </div>

      <div className="ax-karte rounded-xl p-8 shadow-sm">
        <h2 className="text-xl font-bold ax-titel mb-1">Willkommen{einladung?.vorname ? `, ${einladung.vorname}` : ''}</h2>
        <p className="text-sm ax-text-sekundaer mb-6">
          {einladung?.kundeName
            ? <>Dein Zugang für <strong>{einladung.kundeName}</strong> wurde eingerichtet. Setze jetzt dein Passwort, um fortzufahren.</>
            : <>Dein Zugang wurde eingerichtet. Setze jetzt dein Passwort, um fortzufahren.</>}
        </p>

        <div className="bg-axano-orange/10 text-axano-orange text-xs rounded-lg p-3 mb-5 leading-relaxed">
          <strong>E-Mail:</strong> {einladung?.email}
        </div>

        {fehler && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg p-3 mb-4">
            {fehler}
          </div>
        )}

        <form onSubmit={absenden} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">Neues Passwort</label>
            <div className="relative">
              <input
                type={passwortSichtbar ? 'text' : 'password'}
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg ax-eingabe transition-all"
                placeholder="Mindestens 10 Zeichen"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setPasswortSichtbar(!passwortSichtbar)}
                className="absolute right-3 top-1/2 -translate-y-1/2 ax-text-tertiaer hover:ax-text transition-colors"
              >
                {passwortSichtbar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">Passwort wiederholen</label>
            <input
              type={passwortSichtbar ? 'text' : 'password'}
              value={passwortWiederholen}
              onChange={(e) => setPasswortWiederholen(e.target.value)}
              className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe transition-all"
              placeholder="Zur Sicherheit erneut eingeben"
              autoComplete="new-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={sendet}
            className="w-full bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all active:scale-95 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendet ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Passwort setzen & anmelden
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-xs ax-text-tertiaer mt-6">
        Axano GmbH &middot; LeadFlow Plattform
      </p>
    </div>
  );
}
