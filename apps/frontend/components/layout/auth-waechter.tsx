'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';

const KUNDEN_ERLAUBTE_PRAEFIXE = ['/meine-integrationen', '/einstellungen/profil'];

function istPfadFuerKundenErlaubt(pfad: string): boolean {
  return KUNDEN_ERLAUBTE_PRAEFIXE.some((praefix) => pfad === praefix || pfad.startsWith(`${praefix}/`));
}

export function AuthWaechter({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { benutzer, istAuthentifiziert, benutzerSetzen } = useAuthStore();
  const [wirdGeprueft, setWirdGeprueft] = useState(!istAuthentifiziert);

  useEffect(() => {
    if (istAuthentifiziert) {
      setWirdGeprueft(false);
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      router.replace('/anmelden');
      return;
    }

    let abgebrochen = false;
    apiClient
      .get('/auth/profil')
      .then((antwort) => {
        if (abgebrochen) return;
        if (antwort.data?.erfolg && antwort.data?.daten) {
          benutzerSetzen(antwort.data.daten);
        }
        setWirdGeprueft(false);
      })
      .catch(() => {
        if (abgebrochen) return;
        router.replace('/anmelden');
      });

    return () => {
      abgebrochen = true;
    };
  }, [istAuthentifiziert, router, benutzerSetzen]);

  useEffect(() => {
    if (!benutzer || !pathname) return;
    if (benutzer.rolle === 'kunde' && !istPfadFuerKundenErlaubt(pathname)) {
      router.replace('/meine-integrationen');
    }
  }, [benutzer, pathname, router]);

  if (wirdGeprueft) {
    return (
      <div className="flex items-center justify-center min-h-screen ax-seite">
        <div className="w-8 h-8 border-2 border-axano-orange/30 border-t-axano-orange rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
