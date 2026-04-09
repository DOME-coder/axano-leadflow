'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface AnrufVersuch {
  id: string;
  leadId: string;
  versuchNummer: number;
  vapiCallId: string | null;
  status: 'geplant' | 'laeuft' | 'abgeschlossen' | 'fehler';
  geplantFuer: string;
  gestartetAm: string | null;
  beendetAm: string | null;
  dauerSekunden: number | null;
  ergebnis: string | null;
  transkript: string | null;
  gptAnalyse: string | null;
  lead: {
    id: string;
    vorname: string | null;
    nachname: string | null;
    email: string | null;
    telefon: string | null;
    status: string;
  };
}

export function benutzeAnrufe(kampagneId: string) {
  return useQuery({
    queryKey: ['anrufe', kampagneId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/kampagnen/${kampagneId}/anrufe`);
      return data.daten as { eintraege: AnrufVersuch[]; gesamt: number };
    },
    enabled: !!kampagneId,
    refetchInterval: 10000, // Alle 10s aktualisieren
  });
}

export function benutzeAnrufeStarten() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kampagneId: string) => {
      const { data } = await apiClient.post(`/kampagnen/${kampagneId}/anrufe/starten`);
      return data as {
        erfolg: boolean;
        daten: { gestartet: number; uebersprungen: number; gesamt: number };
        nachricht: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anrufe'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

export function benutzeLeadSofortAnrufen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data } = await apiClient.post(`/anrufe/lead/${leadId}/sofort`);
      return data as { erfolg: boolean; nachricht: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anrufe'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}
