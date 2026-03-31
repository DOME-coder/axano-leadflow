'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

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
  return useQuery({
    queryKey: ['analytics', 'uebersicht'],
    queryFn: async () => {
      const { data } = await apiClient.get('/analytics/uebersicht');
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
