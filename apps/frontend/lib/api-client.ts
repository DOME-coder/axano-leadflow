import axios from 'axios';
import { useToastStore } from '@/stores/toast-store';

const API_BASIS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASIS_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request-Interceptor: Token hinzufügen
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response-Interceptor: Token-Erneuerung bei 401, Toast bei 403
// Toast wird mehrfach kurz hintereinander gedrosselt (sonst Spam bei React-Query-Retries
// auf Listen-Endpoints mit 403)
let letzterFehlerToast = 0;
function fehlerToastEinmalig(nachricht: string) {
  if (typeof window === 'undefined') return;
  const jetzt = Date.now();
  if (jetzt - letzterFehlerToast < 3000) return;
  letzterFehlerToast = jetzt;
  useToastStore.getState().toastAnzeigen('fehler', nachricht);
}

apiClient.interceptors.response.use(
  (antwort) => antwort,
  async (fehler) => {
    const originalRequest = fehler.config;

    if (fehler.response?.status === 401 && !originalRequest._wiederholt) {
      originalRequest._wiederholt = true;

      try {
        const antwort = await axios.post(`${API_BASIS_URL}/auth/token-erneuern`, {}, {
          withCredentials: true,
        });

        const { access_token } = antwort.data.daten;
        localStorage.setItem('access_token', access_token);
        originalRequest.headers.Authorization = `Bearer ${access_token}`;

        return apiClient(originalRequest);
      } catch {
        localStorage.removeItem('access_token');
        if (typeof window !== 'undefined') {
          window.location.replace('/anmelden');
        }
      }
    }

    // 403: kein Zugriff. Sanftes UX-Feedback per Toast — kein Redirect, weil
    // manche Workflows legitim 403 ausloesen (z.B. Probe-Aufrufe). Backend-Nachricht
    // bevorzugen, wenn vorhanden.
    if (fehler.response?.status === 403) {
      const backendNachricht = fehler.response?.data?.fehler || fehler.response?.data?.message;
      fehlerToastEinmalig(backendNachricht || 'Du hast keinen Zugriff auf diese Aktion.');
    }

    return Promise.reject(fehler);
  }
);
