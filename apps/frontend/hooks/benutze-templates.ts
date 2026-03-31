'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { EmailTemplate } from '@/lib/typen';

export function benutzeTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await apiClient.get('/templates');
      return data.daten as EmailTemplate[];
    },
  });
}

export function benutzeTemplate(id: string) {
  return useQuery({
    queryKey: ['template', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/templates/${id}`);
      return data.daten as EmailTemplate;
    },
    enabled: !!id,
  });
}

export function benutzeTemplateErstellen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (daten: {
      name: string;
      betreff: string;
      htmlInhalt: string;
      textInhalt?: string;
    }) => {
      const { data } = await apiClient.post('/templates', daten);
      return data.daten as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function benutzeTemplateAktualisieren() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...daten }: { id: string } & Partial<EmailTemplate>) => {
      const { data } = await apiClient.patch(`/templates/${id}`, daten);
      return data.daten as EmailTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}
