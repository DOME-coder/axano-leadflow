'use client';

import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from '@/stores/toast-store';
import type { LucideIcon } from 'lucide-react';

interface ToastStil {
  akzent: string;
  textKlasse: string;
  iconKlasse: string;
  icon: LucideIcon;
}

const toastStile: Record<'erfolg' | 'fehler' | 'info', ToastStil> = {
  erfolg: {
    akzent: '#22c55e',
    textKlasse: 'text-emerald-700 dark:text-emerald-300',
    iconKlasse: 'text-emerald-500 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  fehler: {
    akzent: '#ef4444',
    textKlasse: 'text-red-700 dark:text-red-300',
    iconKlasse: 'text-red-500 dark:text-red-400',
    icon: AlertCircle,
  },
  info: {
    akzent: '#3b82f6',
    textKlasse: 'text-sky-700 dark:text-sky-300',
    iconKlasse: 'text-sky-500 dark:text-sky-400',
    icon: Info,
  },
};

export function ToastContainer() {
  const { toasts, toastEntfernen } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-[100] space-y-2.5 max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const stil = toastStile[toast.typ];
        const Icon = stil.icon;
        return (
          <div
            key={toast.id}
            className="relative pointer-events-auto flex items-start gap-3 px-4 py-3 pr-11 rounded-xl animate-einblenden-von-rechts overflow-hidden"
            style={{
              backgroundColor: 'var(--glas-bg)',
              backdropFilter: 'blur(16px) saturate(160%)',
              WebkitBackdropFilter: 'blur(16px) saturate(160%)',
              border: '1px solid var(--glas-rand)',
              boxShadow: 'var(--schatten-xl)',
            }}
            role="status"
            aria-live="polite"
          >
            {/* Farbiger Left-Accent-Stripe */}
            <span
              aria-hidden
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ backgroundColor: stil.akzent }}
            />
            <Icon
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${stil.iconKlasse}`}
              strokeWidth={2.2}
            />
            <p className={`text-sm font-medium leading-snug flex-1 ${stil.textKlasse}`}>
              {toast.nachricht}
            </p>
            <button
              onClick={() => toastEntfernen(toast.id)}
              aria-label="Benachrichtigung schließen"
              className="absolute top-2 right-2 p-1 rounded-md ax-text-tertiaer hover:ax-text hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-180 ease-schnell ax-fokus-ring"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
