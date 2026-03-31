'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Automatisierung } from '@/lib/typen';

export function benutzeAutomatisierungen(kampagneId: string) {
  return useQuery({
    queryKey: ['automatisierungen', kampagneId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/kampagnen/${kampagneId}/automatisierungen`);
      return data.daten as Automatisierung[];
    },
    enabled: !!kampagneId,
  });
}

export function benutzeAutomatisierungErstellen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kampagneId, ...daten }: {
      kampagneId: string;
      name: string;
      beschreibung?: string;
      triggerTyp: string;
      triggerKonfiguration?: Record<string, unknown>;
      bedingungen?: Array<{ feld: string; operator: string; wert?: string }>;
      schritte: Array<{
        reihenfolge: number;
        aktionTyp: string;
        konfiguration?: Record<string, unknown>;
      }>;
    }) => {
      const { data } = await apiClient.post(`/kampagnen/${kampagneId}/automatisierungen`, daten);
      return data.daten as Automatisierung;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automatisierungen'] });
    },
  });
}

export function benutzeAutomatisierungAktualisieren() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...daten }: { id: string; aktiv?: boolean; name?: string; [key: string]: unknown }) => {
      const { data } = await apiClient.patch(`/automatisierungen/${id}`, daten);
      return data.daten as Automatisierung;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['automatisierungen'] });
    },
  });
}

export function benutzeAutomatisierungLoeschen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/automatisierungen/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automatisierungen'] });
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
    },
  });
}
