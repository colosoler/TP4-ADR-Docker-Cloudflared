import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiPost } from './client';

function mockFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api/client', () => {
  it('un 400 con JSON lanza ApiError con code, message y details', async () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: [{ path: 'anio', message: 'El año debe estar entre 2015 y 2030' }],
      },
    };
    const fetchMock = mockFetch(async () =>
      new Response(JSON.stringify(body), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const error = await apiPost('/autos', { anio: 1990 }).catch((e: unknown) => e);

    expect(fetchMock).toHaveBeenCalledWith('/api/autos', expect.objectContaining({ method: 'POST' }));
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe('VALIDATION_ERROR');
    expect(apiError.message).toBe('Datos inválidos');
    expect(apiError.details).toEqual([{ path: 'anio', message: 'El año debe estar entre 2015 y 2030' }]);
  });

  it('un 502 con HTML lanza ApiError con code BACKEND_UNAVAILABLE', async () => {
    mockFetch(async () =>
      new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const error = await apiGet('/autos').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).code).toBe('BACKEND_UNAVAILABLE');
  });

  it('si fetch falla lanza ApiError con status 0 y NETWORK_ERROR', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const error = await apiGet('/autos').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect((error as ApiError).message).toBe('No hay conexión con el servidor');
  });
});
