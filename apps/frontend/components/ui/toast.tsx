'use client';

import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from '@/stores/toast-store';

const toastStile = {
  erfolg: { bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
  fehler: { bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', icon: AlertCircle },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', icon: Info },
};

export function ToastContainer() {
  const { toasts, toastEntfernen } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => {
        const stil = toastStile[toast.typ];
        const Icon = stil.icon;
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-einblenden ${stil.bg}`}
          >
            <Icon className={`w-4 h-4 flex-shrink-0 ${stil.text}`} />
            <p className={`text-sm font-medium flex-1 ${stil.text}`}>{toast.nachricht}</p>
            <button
              onClick={() => toastEntfernen(toast.id)}
              className={`flex-shrink-0 ${stil.text} opacity-50 hover:opacity-100`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
