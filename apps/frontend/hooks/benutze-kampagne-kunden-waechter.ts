'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUiStore } from '@/stores/ui-store';
import { useToastStore } from '@/stores/toast-store';

/**
 * Beobachtet den globalen Kunden-Filter und leitet zurueck zur Kampagnen-Liste,
 * wenn die aktuell offene Kampagne nicht zum gewaehlten Kunden gehoert.
 *
 * Anwendung in jeder Kampagnen-Detail-Seite (Leads, Anrufe, Automatisierungen,
 * Einstellungen). Verhindert dass beim Kundenwechsel die Detail-Seite eines
 * fremden Kunden weiter sichtbar bleibt — was beim Live-Betrieb verwirrend ist.
 */
export function benutzeKampagneKundenWaechter(kampagneKundeId: string | undefined | null) {
  const router = useRouter();
  const ausgewaehlterKundeId = useUiStore((s) => s.ausgewaehlterKundeId);
  const { toastAnzeigen } = useToastStore();

  useEffect(() => {
    // Kein Filter aktiv oder Kampagne noch nicht geladen -> nichts tun
    if (!ausgewaehlterKundeId || !kampagneKundeId) return;

    // Kampagne gehoert zum gewaehlten Kunden -> alles gut
    if (kampagneKundeId === ausgewaehlterKundeId) return;

    // Mismatch -> raus
    toastAnzeigen('info', 'Diese Kampagne gehoert zu einem anderen Kunden');
    router.replace('/kampagnen');
  }, [ausgewaehlterKundeId, kampagneKundeId, router, toastAnzeigen]);
}
