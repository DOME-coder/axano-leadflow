'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface KundenIntegration {
  name: string;
  typ: string;
  felder: string[];
  eigeneKonfiguration: boolean;
  aktiv: boolean;
  konfiguration: Record<string, string>;
}

export function benutzeKundenIntegrationen(kundeId: string) {
  return useQuery({
    queryKey: ['kunden-integrationen', kundeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen`);
      return data.daten as KundenIntegration[];
    },
    enabled: !!kundeId,
  });
}

export function benutzeKundenIntegrationSpeichern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kundeId, name, konfiguration, aktiv }: {
      kundeId: string;
      name: string;
      konfiguration: Record<string, string>;
      aktiv: boolean;
    }) => {
      const { data } = await apiClient.patch(`/kunden/${kundeId}/integrationen/${name}`, {
        konfiguration,
        aktiv,
      });
      return data.daten;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kunden-integrationen', variables.kundeId] });
    },
  });
}

export function benutzeKundenIntegrationLoeschen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kundeId, name }: { kundeId: string; name: string }) => {
      const { data } = await apiClient.delete(`/kunden/${kundeId}/integrationen/${name}`);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kunden-integrationen', variables.kundeId] });
    },
  });
}

export function benutzeGoogleOAuthUrl(kundeId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen/google/oauth-url`);
      return data.daten as { url: string };
    },
  });
}

export function benutzeOutlookOAuthUrl(kundeId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen/outlook/oauth-url`);
      return data.daten as { url: string };
    },
  });
}

export function benutzeFacebookOAuthUrl(kundeId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen/facebook/oauth-url`);
      return data.daten as { url: string };
    },
  });
}

interface FacebookFormFeld {
  key: string;
  label: string;
  typ: string;
  istStandard: boolean;
  optionen: string[];
}

interface FacebookForm {
  id: string;
  name: string;
  status: string;
  erstelltAm?: string;
  felder: FacebookFormFeld[];
}

export function benutzeFacebookForms(kundeId: string) {
  return useQuery({
    queryKey: ['facebook-forms', kundeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen/facebook/forms`);
      return data.daten as FacebookForm[];
    },
    enabled: !!kundeId,
    staleTime: 60000, // 1 Min Cache
  });
}
