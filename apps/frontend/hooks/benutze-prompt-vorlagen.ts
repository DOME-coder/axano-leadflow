'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { PromptVorlage } from '@/lib/typen';

export function benutzePromptVorlagen(filter?: { branche?: string }) {
  return useQuery({
    queryKey: ['prompt-vorlagen', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.branche) params.set('branche', filter.branche);
      const { data } = await apiClient.get(`/prompt-vorlagen?${params}`);
      return data.daten as PromptVorlage[];
    },
  });
}

export function benutzePromptVorlageErstellen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (daten: {
      name: string;
      beschreibung?: string;
      branche: string;
      produkt?: string;
      vapiPrompt: string;
    }) => {
      const { data } = await apiClient.post('/prompt-vorlagen', daten);
      return data.daten as PromptVorlage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-vorlagen'] });
    },
  });
}

export function benutzePromptVorlageAktualisieren() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...daten }: { id: string } & Partial<PromptVorlage>) => {
      const { data } = await apiClient.patch(`/prompt-vorlagen/${id}`, daten);
      return data.daten as PromptVorlage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-vorlagen'] });
    },
  });
}

export function benutzePromptVorlageLoeschen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/prompt-vorlagen/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-vorlagen'] });
    },
  });
}
