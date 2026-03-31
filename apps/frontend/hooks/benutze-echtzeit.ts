'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

export function benutzeEchtzeit(kampagneId: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const queryClient = useQueryClient();

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

    socket.on('lead:neu', () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', kampagneId] });
      queryClient.invalidateQueries({ queryKey: ['leads', kampagneId] });
      queryClient.invalidateQueries({ queryKey: ['kampagnen'] });
    });

    socket.on('lead:aktualisiert', () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline', kampagneId] });
      queryClient.invalidateQueries({ queryKey: ['leads', kampagneId] });
    });

    return () => {
      socket.emit('kampagne:verlassen', kampagneId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [kampagneId, queryClient]);

  return socketRef;
}
