'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const API_BASIS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

interface Antwort {
  erfolg: boolean;
  daten?: { bereitsAbgemeldet: boolean; email: string | null };
  fehler?: string;
}

export default function AbmeldenSeite({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState<'laedt' | 'erfolg' | 'bereitsAbgemeldet' | 'fehler'>('laedt');
  const [email, setEmail] = useState<string | null>(null);
  const [fehlerNachricht, setFehlerNachricht] = useState<string>('');

  useEffect(() => {
    fetch(`${API_BASIS_URL}/abmelden/${params.token}`)
      .then(async (response) => {
        const json: Antwort = await response.json();
        if (!response.ok || !json.erfolg) {
          setStatus('fehler');
          setFehlerNachricht(json.fehler || 'Abmeldung fehlgeschlagen');
          return;
        }
        setEmail(json.daten?.email ?? null);
        setStatus(json.daten?.bereitsAbgemeldet ? 'bereitsAbgemeldet' : 'erfolg');
      })
      .catch(() => {
        setStatus('fehler');
        setFehlerNachricht('Netzwerkfehler. Bitte später erneut versuchen.');
      });
  }, [params.token]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
        {status === 'laedt' && (
          <div className="flex flex-col items-center text-center">
            <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Abmeldung wird verarbeitet…</p>
          </div>
        )}

        {status === 'erfolg' && (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Erfolgreich abgemeldet</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {email ? <>Wir senden keine weiteren E-Mails mehr an <strong>{email}</strong>.</> : 'Sie erhalten keine weiteren E-Mails von uns.'}
            </p>
          </div>
        )}

        {status === 'bereitsAbgemeldet' && (
          <div className="flex flex-col items-center text-center">
            <CheckCircle2 className="w-12 h-12 text-blue-500 mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Bereits abgemeldet</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {email ? <>Sie sind bereits abgemeldet. Wir senden keine E-Mails an <strong>{email}</strong>.</> : 'Sie waren bereits abgemeldet.'}
            </p>
          </div>
        )}

        {status === 'fehler' && (
          <div className="flex flex-col items-center text-center">
            <XCircle className="w-12 h-12 text-red-500 mb-4" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-2">Abmeldung fehlgeschlagen</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{fehlerNachricht}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
              Falls das Problem bestehen bleibt, schreiben Sie an datenschutz@axano.com.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
