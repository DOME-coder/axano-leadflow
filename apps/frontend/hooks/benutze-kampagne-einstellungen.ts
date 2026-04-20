'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Kampagne } from '@/lib/typen';

interface KampagneEinstellungen {
  id: string;
  vapiAktiviert?: boolean;
  vapiAssistantId?: string | null;
  vapiPhoneNumberId?: string | null;
  vapiPrompt?: string | null;
  maxAnrufVersuche?: number;
  emailAktiviert?: boolean;
  emailTemplateVerpasst?: string | null;
  emailTemplateVoicemail?: string | null;
  emailTemplateUnerreichbar?: string | null;
  emailTemplateTerminBestaetigung?: string | null;
  emailTemplateRueckruf?: string | null;
  emailTemplateNichtInteressiert?: string | null;
  whatsappAktiviert?: boolean;
  whatsappKanalId?: string | null;
  whatsappTemplateVerpasst?: string | null;
  whatsappTemplateUnerreichbar?: string | null;
  whatsappTemplateNichtInteressiert?: string | null;
  whatsappAnbieter?: 'superchat' | 'meta';
  whatsappMetaPhoneNumberId?: string | null;
  whatsappTemplateVerpasstName?: string | null;
  whatsappTemplateVerpasstSprache?: string | null;
  whatsappTemplateUnerreichbarName?: string | null;
  whatsappTemplateUnerreichbarSprache?: string | null;
  whatsappTemplateNichtInteressiertName?: string | null;
  whatsappTemplateNichtInteressiertSprache?: string | null;
  kiName?: string | null;
  kiGeschlecht?: string | null;
  kiSprachstil?: string | null;
  benachrichtigungEmail?: string | null;
  calendlyLink?: string | null;
  triggerKonfiguration?: Record<string, unknown>;
}

export function benutzeKampagneEinstellungenSpeichern() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...daten }: KampagneEinstellungen) => {
      const { data } = await apiClient.patch(`/kampagnen/${id}`, daten);
      return data.daten as Kampagne;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kampagne'] });
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
    },
  });
}

// Abwärtskompatibel: alter Hook-Name für bestehende Imports
export const benutzeKampagneKonfigSpeichern = benutzeKampagneEinstellungenSpeichern;
