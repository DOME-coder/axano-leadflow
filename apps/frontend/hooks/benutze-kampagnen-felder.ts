'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface KampagnenFeld {
  id: string;
  feldname: string;
  bezeichnung: string;
  feldtyp: 'text' | 'zahl' | 'email' | 'telefon' | 'datum' | 'auswahl' | 'ja_nein' | 'mehrzeilig';
  pflichtfeld: boolean;
  optionen: string[] | null;
  reihenfolge: number;
  platzhalter: string | null;
  hilfetext: string | null;
}

export interface FeldEingabe {
  bezeichnung: string;
  feldtyp: KampagnenFeld['feldtyp'];
  pflichtfeld?: boolean;
  optionen?: string[];
  platzhalter?: string;
  hilfetext?: string;
}

export function benutzeFeldHinzufuegen(kampagneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (daten: FeldEingabe) => {
      const { data } = await apiClient.post(`/kampagnen/${kampagneId}/felder`, daten);
      return data.daten as KampagnenFeld;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagne', kampagneId] });
    },
  });
}

export function benutzeFeldAktualisieren(kampagneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ feldId, daten }: { feldId: string; daten: Partial<FeldEingabe> }) => {
      const { data } = await apiClient.patch(`/kampagnen/${kampagneId}/felder/${feldId}`, daten);
      return data.daten as KampagnenFeld;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagne', kampagneId] });
    },
  });
}

export function benutzeFeldLoeschen(kampagneId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (feldId: string) => {
      await apiClient.delete(`/kampagnen/${kampagneId}/felder/${feldId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagne', kampagneId] });
    },
  });
}
