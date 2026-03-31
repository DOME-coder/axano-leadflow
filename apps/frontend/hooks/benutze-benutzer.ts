'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Benutzer } from '@/lib/typen';

export function benutzeBenutzer() {
  return useQuery({
    queryKey: ['benutzer'],
    queryFn: async () => {
      const { data } = await apiClient.get('/benutzer');
      return data.daten as Benutzer[];
    },
  });
}

export function benutzeBenutzerErstellen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (daten: {
      email: string;
      vorname: string;
      nachname: string;
      passwort: string;
      rolle?: string;
    }) => {
      const { data } = await apiClient.post('/benutzer', daten);
      return data.daten as Benutzer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benutzer'] });
    },
  });
}

export function benutzeBenutzerAktualisieren() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...daten }: { id: string; rolle?: string; aktiv?: boolean }) => {
      const { data } = await apiClient.patch(`/benutzer/${id}`, daten);
      return data.daten as Benutzer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['benutzer'] });
    },
  });
}
