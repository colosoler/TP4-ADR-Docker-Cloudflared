import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { apiGet } from '../../api/client';
import { useToast } from '../components/Toast';

const POLL_OK_MS = 30_000;
const POLL_CAIDO_MS = 5_000;

interface Health {
  status: string;
  db: 'up' | 'down';
}

// Estado global "la base está caída". Lo escriben el polling de /api/health
// y el onError de QueryCache/MutationCache (main.tsx) ante un 503 o status 0.
let caido = false;
const listeners = new Set<() => void>();

function setCaido(valor: boolean) {
  if (caido === valor) return;
  caido = valor;
  listeners.forEach((l) => l());
}

export function marcarDbCaida(): void {
  setCaido(true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => caido;

async function dbResponde(): Promise<boolean> {
  try {
    const health = await apiGet<Health>('/health');
    return health.db === 'up';
  } catch {
    return false;
  }
}

/**
 * Hace polling de GET /api/health: cada 30 s si todo anda, cada 5 s si está caído.
 * Cuando la base vuelve, recarga todas las queries y muestra "Conexión recuperada".
 * Se usa una sola vez, en el Layout.
 */
export function useDbStatus(): { dbCaida: boolean } {
  const dbCaida = useSyncExternalStore(subscribe, getSnapshot);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const anterior = useRef(dbCaida);

  // Transición caído → arriba.
  useEffect(() => {
    if (anterior.current && !dbCaida) {
      void queryClient.invalidateQueries();
      showToast('Conexión recuperada', 'success');
    }
    anterior.current = dbCaida;
  }, [dbCaida, queryClient, showToast]);

  // Chequeo inicial al montar.
  useEffect(() => {
    let cancelado = false;
    void dbResponde().then((ok) => {
      if (!cancelado) setCaido(!ok);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Polling. Si el estado cambia, el efecto se reinicia con el intervalo nuevo.
  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;

    const programar = () => {
      timer = setTimeout(async () => {
        const ok = await dbResponde();
        if (cancelado) return;
        setCaido(!ok);
        if (getSnapshot() === dbCaida) programar();
      }, dbCaida ? POLL_CAIDO_MS : POLL_OK_MS);
    };
    programar();

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [dbCaida]);

  return { dbCaida };
}
