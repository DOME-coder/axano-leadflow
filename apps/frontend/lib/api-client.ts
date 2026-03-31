import axios from 'axios';

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

// Response-Interceptor: Token-Erneuerung
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

    return Promise.reject(fehler);
  }
);
