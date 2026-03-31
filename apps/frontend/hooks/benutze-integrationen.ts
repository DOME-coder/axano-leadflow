'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { IntegrationStatus } from '@/lib/typen';

interface IntegrationDaten {
  name: string;
  typ: string;
  felder: string[];
  aktiv: boolean;
  konfiguration: Record<string, string>;
}

export function benutzeIntegrationsStatus() {
  return useQuery({
    queryKey: ['integrationen-status'],
    queryFn: async () => {
      const { data } = await apiClient.get('/integrationen/status');
      return data.daten as IntegrationStatus[];
    },
    staleTime: 60_000,
  });
}

export function benutzeIntegrationen() {
  return useQuery({
    queryKey: ['integrationen'],
    queryFn: async () => {
      const { data } = await apiClient.get('/integrationen');
      return data.daten as IntegrationDaten[];
    },
  });
}

export function benutzeIntegrationSpeichern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, konfiguration, aktiv }: {
      name: string;
      konfiguration: Record<string, string>;
      aktiv: boolean;
    }) => {
      const { data } = await apiClient.patch(`/integrationen/${name}`, { konfiguration, aktiv });
      return data.daten;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrationen'] });
    },
  });
}

export function benutzeIntegrationTesten() {
  return useMutation({
    mutationFn: async ({ name, konfiguration }: {
      name: string;
      konfiguration: Record<string, string>;
    }) => {
      const { data } = await apiClient.post(`/integrationen/${name}/testen`, { konfiguration });
      return data as { erfolg: boolean; nachricht: string };
    },
  });
}
