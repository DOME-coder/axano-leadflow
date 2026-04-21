'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plug } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { useToastStore } from '@/stores/toast-store';
import { KundenIntegrationenSektion } from '@/components/kunden/kunden-integrationen-sektion';

export default function MeineIntegrationenSeite() {
  const { benutzer } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toastAnzeigen } = useToastStore();

  useEffect(() => {
    if (!searchParams) return;
    const google = searchParams.get('google_calendar');
    const outlook = searchParams.get('outlook_calendar');
    const facebook = searchParams.get('facebook_lead_ads');
    const whatsapp = searchParams.get('whatsapp');
    const grund = searchParams.get('grund');

    if (google === 'verbunden') toastAnzeigen('erfolg', 'Google Calendar erfolgreich verbunden');
    else if (google === 'fehler') toastAnzeigen('fehler', `Google Calendar konnte nicht verbunden werden${grund ? `: ${grund}` : ''}`);
    else if (outlook === 'verbunden') toastAnzeigen('erfolg', 'Outlook Calendar erfolgreich verbunden');
    else if (outlook === 'fehler') toastAnzeigen('fehler', `Outlook Calendar konnte nicht verbunden werden${grund ? `: ${grund}` : ''}`);
    else if (facebook === 'verbunden') toastAnzeigen('erfolg', 'Facebook Lead Ads erfolgreich verbunden');
    else if (facebook === 'fehler') toastAnzeigen('fehler', `Facebook konnte nicht verbunden werden${grund ? `: ${grund}` : ''}`);
    else if (whatsapp === 'verbunden') toastAnzeigen('erfolg', 'WhatsApp Business erfolgreich verbunden');
    else if (whatsapp === 'fehler') toastAnzeigen('fehler', `WhatsApp konnte nicht verbunden werden${grund ? `: ${grund}` : ''}`);

    if (google || outlook || facebook || whatsapp) {
      router.replace('/meine-integrationen');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (!benutzer) return null;

  if (!benutzer.kundeId) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="ax-karte rounded-xl p-6">
          <h1 className="text-lg font-semibold ax-titel mb-2">Keine Kunden-Zuordnung</h1>
          <p className="text-sm ax-text-sekundaer">
            Dein Benutzerkonto ist noch keinem Kunden zugeordnet. Bitte wende dich an das Axano-Team.
          </p>
        </div>
      </div>
    );
  }

  const anzeigeName = benutzer.kunde?.name || 'deinen Zugang';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-axano-orange/10 flex items-center justify-center flex-shrink-0">
          <Plug className="w-5 h-5 text-axano-orange" strokeWidth={2} />
        </div>
        <div>
          <h1 className="text-xl font-bold ax-titel">Hallo {benutzer.vorname} — richte deine Dienste ein</h1>
          <p className="text-sm ax-text-sekundaer mt-1">
            Hier verbindest du die Werkzeuge, die Axano LeadFlow im Namen von <strong>{anzeigeName}</strong> nutzt:
            Facebook Lead Ads, WhatsApp, Google/Outlook Kalender und mehr. Deine Passwörter bleiben bei dir —
            wir speichern nur die Freigabe-Tokens der jeweiligen Anbieter.
          </p>
        </div>
      </div>

      <KundenIntegrationenSektion kundeId={benutzer.kundeId} />
    </div>
  );
}
