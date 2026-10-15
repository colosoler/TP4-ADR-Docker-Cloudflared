// Cliente de la API. Las rutas son relativas a /api: apiGet('/autos').
// Nunca URLs absolutas: el navegador habla siempre con un único origen (sin CORS).

const API_BASE = '/api';

export interface ErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ErrorBody {
  error: { code: string; message: string; details?: ErrorDetail[] };
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();
    if (isErrorBody(body)) {
      return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
  } catch {
    // El body no es JSON (por ejemplo, un 502 en HTML): cae al error genérico de abajo.
  }
  return new ApiError(
    response.status,
    'BACKEND_UNAVAILABLE',
    'El servidor no responde. Probá de nuevo en unos segundos.',
  );
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No hay conexión con el servidor');
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiGet = <T>(path: string): Promise<T> => request<T>(path, 'GET');

export const apiPost = <T>(path: string, body: unknown): Promise<T> => request<T>(path, 'POST', body);

export const apiPut = <T>(path: string, body: unknown): Promise<T> => request<T>(path, 'PUT', body);

export const apiDelete = (path: string): Promise<void> => request<void>(path, 'DELETE');
