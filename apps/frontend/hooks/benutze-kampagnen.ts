'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Kampagne, PaginierteAntwort, KiGenerierungErgebnis } from '@/lib/typen';
import { useUiStore } from '@/stores/ui-store';

export function benutzeKampagnen(filter?: { status?: string }) {
  const kundeId = useUiStore((s) => s.ausgewaehlterKundeId);
  return useQuery({
    queryKey: ['kampagnen', filter?.status ?? null, kundeId ?? null],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.status) params.set('status', filter.status);
      if (kundeId) params.set('kunde_id', kundeId);
      const queryString = params.toString();
      const url = queryString ? `/kampagnen?${queryString}` : '/kampagnen';
      const { data } = await apiClient.get(url);
      return data.daten as PaginierteAntwort<Kampagne>;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function benutzeKampagne(id: string) {
  return useQuery({
    queryKey: ['kampagne', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/kampagnen/${id}`);
      return data.daten as Kampagne;
    },
    enabled: !!id,
  });
}

export function benutzeKampagneErstellen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (daten: {
      name: string;
      beschreibung?: string;
      triggerTyp: string;
      triggerKonfiguration?: Record<string, unknown>;
      pipelineSpalten?: string[];
      vapiAktiviert?: boolean;
      vapiAssistantId?: string | null;
      vapiPhoneNumberId?: string | null;
      vapiPrompt?: string | null;
      vapiErsteBotschaft?: string | null;
      vapiVoicemailNachricht?: string | null;
      maxAnrufVersuche?: number;
      emailAktiviert?: boolean;
      emailTemplateVerpasst?: string | null;
      emailTemplateVoicemail?: string | null;
      emailTemplateUnerreichbar?: string | null;
      whatsappAktiviert?: boolean;
      whatsappKanalId?: string | null;
      whatsappTemplateVerpasst?: string | null;
      whatsappTemplateUnerreichbar?: string | null;
      whatsappTemplateNichtInteressiert?: string | null;
      benachrichtigungEmail?: string | null;
      calendlyLink?: string | null;
      branche?: string | null;
      produkt?: string | null;
      zielgruppe?: string | null;
      ton?: string | null;
      kiName?: string | null;
      kiGeschlecht?: string | null;
      kiSprachstil?: string | null;
      kundeId?: string | null;
      felder?: Array<{
        feldname: string;
        bezeichnung: string;
        feldtyp: string;
        pflichtfeld?: boolean;
        reihenfolge?: number;
      }>;
    }) => {
      const { data } = await apiClient.post('/kampagnen', daten);
      return data.daten as Kampagne;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
    },
  });
}

export function benutzeKampagneAktualisieren() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...daten }: { id: string } & Partial<Kampagne>) => {
      const { data } = await apiClient.patch(`/kampagnen/${id}`, daten);
      return data.daten as Kampagne;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
    },
  });
}

export function benutzeKampagneDuplizieren() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/kampagnen/${id}/duplizieren`);
      return data.daten as Kampagne;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
    },
  });
}

export function benutzeKampagneLoeschen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/kampagnen/${id}`);
      return data.daten;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
    },
  });
}

export function benutzeKampagneWiederherstellen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post(`/kampagnen/${id}/wiederherstellen`);
      return data.daten;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
    },
  });
}

export function benutzeKampagneEndgueltigLoeschen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/kampagnen/${id}/endgueltig`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
    },
  });
}

export function benutzeKiGenerierung() {
  return useMutation({
    mutationFn: async (daten: {
      branche: string;
      produkt: string;
      zielgruppe: string;
      ton: string;
      kiName?: string;
      kiGeschlecht?: string;
      kiSprachstil?: string;
      zusatzFelder?: string[];
    }) => {
      const { data } = await apiClient.post('/kampagnen/ki-generieren', daten);
      return data.daten as KiGenerierungErgebnis;
    },
  });
}
