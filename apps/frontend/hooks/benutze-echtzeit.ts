'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/stores/toast-store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

interface LeadNeuEvent {
  lead?: {
    vorname?: string | null;
    nachname?: string | null;
    email?: string | null;
    telefon?: string | null;
    kampagneName?: string;
  };
}

interface LeadAktualisiertEvent {
  lead?: {
    vorname?: string | null;
    nachname?: string | null;
    status?: string;
  };
}

function leadAnzeigename(lead: { vorname?: string | null; nachname?: string | null; email?: string | null; telefon?: string | null } | undefined): string {
  if (!lead) return 'Neuer Lead';
  const name = [lead.vorname, lead.nachname].filter(Boolean).join(' ').trim();
  return name || lead.email || lead.telefon || 'Unbekannter Lead';
}

export function benutzeEchtzeit(kampagneId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();
  const { toastAnzeigen } = useToastStore();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token || !kampagneId) return;

    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('kampagne:beitreten', kampagneId);
    });

    socket.on('lead:neu', (event: LeadNeuEvent) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', kampagneId] });
      queryClient.invalidateQueries({ queryKey: ['leads', kampagneId] });
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
      toastAnzeigen('info', `Neuer Lead: ${leadAnzeigename(event.lead)}`);
    });

    socket.on('lead:aktualisiert', (event: LeadAktualisiertEvent) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', kampagneId] });
      queryClient.invalidateQueries({ queryKey: ['leads', kampagneId] });
      if (event.lead?.status) {
        toastAnzeigen('info', `${leadAnzeigename(event.lead)}: ${event.lead.status}`);
      }
    });

    return () => {
      socket.emit('kampagne:verlassen', kampagneId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [kampagneId, queryClient, toastAnzeigen]);

  return socketRef;
}
