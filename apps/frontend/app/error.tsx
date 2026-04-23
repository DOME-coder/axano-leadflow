'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Next.js Error-Boundary fuer das gesamte App-Verzeichnis.
 * Wird angezeigt wenn eine React-Komponente crasht. Faengt Rendering-Fehler ab,
 * damit der Nutzer keine nackte Next.js-Error-Page sieht.
 */
export default function GlobalerFehler({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App-Fehler:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--hintergrund)]">
      <div className="ax-karte rounded-xl p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" strokeWidth={2.2} />
        </div>
        <h1 className="text-xl font-bold ax-titel mb-2">Etwas ist schiefgelaufen</h1>
        <p className="text-sm ax-text-sekundaer mb-6 leading-relaxed">
          Wir haben den Fehler automatisch erfasst und kuemmern uns darum. Du kannst
          die Seite neu laden oder zum Dashboard zurueckkehren.
        </p>
        {error.digest && (
          <p className="text-xs ax-text-tertiaer mb-4 font-mono">
            Fehler-ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="bg-axano-orange hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-all"
          >
            Erneut versuchen
          </button>
          <a
            href="/dashboard"
            className="border ax-rahmen-leicht ax-text px-5 py-2.5 rounded-lg text-sm hover:ax-hover transition-all"
          >
            Zum Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
