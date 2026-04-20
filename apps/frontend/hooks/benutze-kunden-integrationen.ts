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
    staleTime: 60000,
    retry: false,
  });
}

// Facebook-Diagnose: ausfuehrlicher Check der Verbindung
export interface FacebookDiagnoseSeite {
  id: string;
  name: string;
  istVerbunden: boolean;
  quelle: 'persoenlich' | 'business-owned' | 'business-client';
  businessName?: string;
  formAnzahl?: number;
  formFehler?: string;
}

export interface FacebookDiagnoseFormular {
  id: string;
  name: string;
  status: string;
  seiteId: string;
  seiteName: string;
  felderAnzahl: number;
}

export interface FacebookDiagnose {
  verbunden: boolean;
  verbindungsFehler: string | null;
  verbundeneSeite: { id: string; name: string } | null;
  erteilteBerechtigungen: string[];
  fehlendeBerechtigungen: string[];
  alleSeiten: FacebookDiagnoseSeite[];
  formulare: FacebookDiagnoseFormular[];
  empfehlungen: string[];
}

export function benutzeFacebookDiagnose(kundeId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen/facebook/diagnose`);
      return data.daten as FacebookDiagnose;
    },
  });
}

// ─── WhatsApp Business (Meta) ─────────────────────────────

export function benutzeWhatsappOAuthUrl(kundeId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen/whatsapp/oauth-url`);
      return data.daten as { url: string };
    },
  });
}

export interface WhatsappPhoneNumber {
  wabaId: string;
  wabaName: string;
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  qualityRating?: string;
}

export function benutzeWhatsappPhoneNumbers(kundeId: string) {
  return useQuery({
    queryKey: ['whatsapp-phone-numbers', kundeId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen/whatsapp/phone-numbers`);
      return data.daten as WhatsappPhoneNumber[];
    },
    enabled: !!kundeId,
    staleTime: 60000,
    retry: false,
  });
}

export interface WhatsappTemplate {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  category: string;
  language: string;
}

export function benutzeWhatsappTemplates(kundeId: string, wabaId?: string) {
  return useQuery({
    queryKey: ['whatsapp-templates', kundeId, wabaId],
    queryFn: async () => {
      const params = wabaId ? `?wabaId=${wabaId}` : '';
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen/whatsapp/templates${params}`);
      return data.daten as WhatsappTemplate[];
    },
    enabled: !!kundeId,
    staleTime: 60000,
    retry: false,
  });
}

export interface WhatsappDiagnoseWaba {
  id: string;
  name: string;
  istVerbunden: boolean;
  phoneNumbers: Array<{
    id: string;
    displayPhoneNumber: string;
    verifiedName: string;
    qualityRating?: string;
  }>;
  templateAnzahl?: number;
  templateGenehmigt?: number;
}

export interface WhatsappDiagnose {
  verbunden: boolean;
  verbindungsFehler: string | null;
  verbundeneWaba: { id: string; name: string } | null;
  verbundenePhoneNumber: { id: string; display: string } | null;
  erteilteBerechtigungen: string[];
  fehlendeBerechtigungen: string[];
  wabas: WhatsappDiagnoseWaba[];
  empfehlungen: string[];
}

export function benutzeWhatsappDiagnose(kundeId: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get(`/kunden/${kundeId}/integrationen/whatsapp/diagnose`);
      return data.daten as WhatsappDiagnose;
    },
  });
}
