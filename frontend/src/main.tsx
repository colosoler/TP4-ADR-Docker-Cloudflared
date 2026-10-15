import '@fontsource/barlow-condensed/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './index.css';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError } from './api/client';
import { App } from './App';
import { ToastProvider } from './shared/components/Toast';
import { marcarDbCaida } from './shared/hooks/useDbStatus';

// Un 503 (DB_UNAVAILABLE / BACKEND_UNAVAILABLE) o status 0 (sin red) en cualquier
// query o mutation muestra el banner de "base caída" sin esperar al próximo polling.
function detectarCaida(error: unknown) {
  if (error instanceof ApiError && (error.status === 503 || error.status === 0)) {
    marcarDbCaida();
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: detectarCaida }),
  mutationCache: new MutationCache({ onError: detectarCaida }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
