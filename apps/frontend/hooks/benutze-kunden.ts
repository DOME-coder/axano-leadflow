'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Kunde, PaginierteAntwort } from '@/lib/typen';

export function benutzeKunden(filter?: { suche?: string }) {
  return useQuery({
    queryKey: ['kunden', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.suche) params.set('suche', filter.suche);
      const { data } = await apiClient.get(`/kunden?${params}`);
      return data.daten as PaginierteAntwort<Kunde>;
    },
  });
}

export function benutzeKunde(id: string) {
  return useQuery({
    queryKey: ['kunde', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/kunden/${id}`);
      return data.daten as Kunde & {
        kampagnen: Array<{
          id: string;
          name: string;
          status: string;
          erstelltAm: string;
          _count: { leads: number };
        }>;
      };
    },
    enabled: !!id,
  });
}

export function benutzeKundeErstellen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (daten: {
      name: string;
      kontaktperson?: string;
      email?: string;
      telefon?: string;
      branche?: string;
      notizen?: string;
    }) => {
      const { data } = await apiClient.post('/kunden', daten);
      return data.daten as Kunde;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kunden'] });
    },
  });
}

export function benutzeKundeAktualisieren() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...daten }: { id: string } & Partial<Kunde>) => {
      const { data } = await apiClient.patch(`/kunden/${id}`, daten);
      return data.daten as Kunde;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kunden'] });
      queryClient.invalidateQueries({ queryKey: ['kunde'] });
    },
  });
}

export function benutzeKundeLoeschen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/kunden/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kunden'] });
    },
  });
}
