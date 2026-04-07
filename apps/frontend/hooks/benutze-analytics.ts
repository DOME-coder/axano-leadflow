'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useUiStore } from '@/stores/ui-store';

interface PlattformUebersicht {
  gesamtLeads: number;
  leadsHeute: number;
  leadsDieseWoche: number;
  leadsMonat: number;
  aktiveKampagnen: number;
  conversionRateGesamt: number;
}

interface KampagnenAnalytics {
  leadsZeitreihe: Array<{ datum: string; anzahl: number }>;
  statusVerteilung: Record<string, number>;
  quellenVerteilung: Record<string, number>;
  automatisierungen: { emailsGesendet: number; whatsappGesendet: number };
  gesamtLeads: number;
  conversionRate: number;
}

export function benutzeUebersicht() {
  const kundeId = useUiStore((s) => s.ausgewaehlterKundeId);
  return useQuery({
    queryKey: ['analytics', 'uebersicht', kundeId],
    queryFn: async () => {
      const params = kundeId ? `?kunde_id=${kundeId}` : '';
      const { data } = await apiClient.get(`/analytics/uebersicht${params}`);
      return data.daten as PlattformUebersicht;
    },
  });
}

export function benutzeKampagnenAnalytics(kampagneId: string, zeitraum: string) {
  return useQuery({
    queryKey: ['analytics', 'kampagne', kampagneId, zeitraum],
    queryFn: async () => {
      const { data } = await apiClient.get(`/analytics/kampagnen/${kampagneId}?zeitraum=${zeitraum}`);
      return data.daten as KampagnenAnalytics;
    },
    enabled: !!kampagneId,
  });
}
