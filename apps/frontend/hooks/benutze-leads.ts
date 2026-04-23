'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Lead, PaginierteAntwort } from '@/lib/typen';

interface PipelineDaten {
  spalten: string[];
  pipeline: Record<string, Lead[]>;
}

export function benutzePipeline(kampagneId: string) {
  return useQuery({
    queryKey: ['pipeline', kampagneId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/kampagnen/${kampagneId}/leads/pipeline`);
      return data.daten as PipelineDaten;
    },
    enabled: !!kampagneId,
  });
}

export function benutzeLeads(kampagneId: string, filter?: {
  status?: string;
  suche?: string;
  seite?: number;
}) {
  return useQuery({
    queryKey: ['leads', kampagneId, filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter?.status) params.set('status', filter.status);
      if (filter?.suche) params.set('suche', filter.suche);
      if (filter?.seite) params.set('seite', String(filter.seite));
      const { data } = await apiClient.get(`/kampagnen/${kampagneId}/leads?${params}`);
      return data.daten as PaginierteAntwort<Lead>;
    },
    enabled: !!kampagneId,
  });
}

export function benutzeLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/leads/${id}`);
      return data.daten;
    },
    enabled: !!id,
  });
}

export function benutzeLeadAktualisieren() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...daten }: { id: string; status?: string; zugewiesenAn?: string | null }) => {
      const { data } = await apiClient.patch(`/leads/${id}`, daten);
      return data.daten as Lead;
    },
    onSuccess: (_data, variablen) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variablen.id] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function benutzeLeadLoeschen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/leads/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

export function benutzeNotizHinzufuegen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, inhalt }: { leadId: string; inhalt: string }) => {
      const { data } = await apiClient.post(`/leads/${leadId}/notizen`, { inhalt });
      return data.daten;
    },
    onSuccess: (_data, variablen) => {
      queryClient.invalidateQueries({ queryKey: ['lead', variablen.leadId] });
    },
  });
}

export function benutzeLeadAnrufRetry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data } = await apiClient.post(`/leads/${leadId}/anruf-retry`);
      return data;
    },
    onSuccess: (_data, leadId) => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}
