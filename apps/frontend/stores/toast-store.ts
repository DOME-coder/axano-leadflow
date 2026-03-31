import { create } from 'zustand';

interface Toast {
  id: string;
  typ: 'erfolg' | 'fehler' | 'info';
  nachricht: string;
}

interface ToastZustand {
  toasts: Toast[];
  toastAnzeigen: (typ: Toast['typ'], nachricht: string) => void;
  toastEntfernen: (id: string) => void;
}

export const useToastStore = create<ToastZustand>((set) => ({
  toasts: [],
  toastAnzeigen: (typ, nachricht) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, typ, nachricht }],
    }));
    // Auto-Hide nach 4 Sekunden
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },
  toastEntfernen: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
