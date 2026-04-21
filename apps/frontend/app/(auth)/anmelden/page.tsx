'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

const anmeldeSchema = z.object({
  email: z.string().email('Bitte geben Sie eine gültige E-Mail-Adresse ein'),
  passwort: z.string().min(8, 'Das Passwort muss mindestens 8 Zeichen lang sein'),
});

type AnmeldeDaten = z.infer<typeof anmeldeSchema>;

export default function AnmeldenSeite() {
  const router = useRouter();
  const { benutzerSetzen } = useAuthStore();
  const [passwortSichtbar, setPaswortSichtbar] = useState(false);
  const [ladevorgang, setLadevorgang] = useState(false);
  const [fehlerNachricht, setFehlerNachricht] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AnmeldeDaten>({
    resolver: zodResolver(anmeldeSchema),
  });

  const anmelden = async (daten: AnmeldeDaten) => {
    setLadevorgang(true);
    setFehlerNachricht('');

    try {
      const antwort = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/anmelden`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: daten.email,
            passwort: daten.passwort,
          }),
        }
      );

      const ergebnis = await antwort.json();

      if (!ergebnis.erfolg) {
        setFehlerNachricht(ergebnis.fehler || 'Anmeldung fehlgeschlagen');
        return;
      }

      localStorage.setItem('access_token', ergebnis.daten.access_token);
      benutzerSetzen(ergebnis.daten.benutzer);
      const zielPfad = ergebnis.daten.benutzer?.rolle === 'kunde' ? '/meine-integrationen' : '/dashboard';
      router.push(zielPfad);
    } catch {
      setFehlerNachricht('Verbindung zum Server fehlgeschlagen');
    } finally {
      setLadevorgang(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-einblenden">
      {/* Logo-Bereich */}
      <div className="text-center mb-8">
        <img src="/logo.png" alt="Axano" className="h-10 mx-auto mb-2 dark:brightness-0 dark:invert" />
        <p className="text-xs ax-text-sekundaer font-medium tracking-wider uppercase">LeadFlow Plattform</p>
      </div>

      {/* Anmeldeformular */}
      <div className="ax-karte rounded-xl p-8 shadow-sm">
        <h2 className="text-xl font-bold ax-titel mb-1">Anmelden</h2>
        <p className="text-sm ax-text-sekundaer mb-6">
          Melden Sie sich mit Ihren Zugangsdaten an
        </p>

        {fehlerNachricht && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg p-3 mb-4">
            {fehlerNachricht}
          </div>
        )}

        <form onSubmit={handleSubmit(anmelden)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">E-Mail-Adresse</label>
            <input
              type="email"
              {...register('email')}
              className="w-full px-3 py-2.5 text-sm rounded-lg ax-eingabe transition-all"
              placeholder="name@axano.de"
              autoComplete="email"
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium ax-text">Passwort</label>
            <div className="relative">
              <input
                type={passwortSichtbar ? 'text' : 'password'}
                {...register('passwort')}
                className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg ax-eingabe transition-all"
                placeholder="Ihr Passwort"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setPaswortSichtbar(!passwortSichtbar)}
                className="absolute right-3 top-1/2 -translate-y-1/2 ax-text-tertiaer hover:ax-text transition-colors"
              >
                {passwortSichtbar ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.passwort && (
              <p className="text-xs text-red-500">{errors.passwort.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={ladevorgang}
            className="w-full bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg transition-all active:scale-95 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {ladevorgang ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Anmelden
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
