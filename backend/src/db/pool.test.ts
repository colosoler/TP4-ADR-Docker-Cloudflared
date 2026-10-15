import { createServer, type AddressInfo, type Socket } from 'node:net';
import { types } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableError } from '../errors';
import { checkDb, query } from './pool';

// Puerto donde no escucha nadie: una base caída de verdad
const PUERTO_SIN_BASE = 1;

// pg lee PGHOST y PGPORT cada vez que abre una conexión
function apuntarLaBaseA(port: number): void {
  vi.stubEnv('PGHOST', '127.0.0.1');
  vi.stubEnv('PGPORT', String(port));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parsers de tipos', () => {
  it('bigint (ids) y numeric (precios) llegan como number, no como texto', () => {
    expect(types.getTypeParser(types.builtins.INT8, 'text')('42')).toBe(42);
    expect(types.getTypeParser(types.builtins.NUMERIC, 'text')('42500000.50')).toBe(42500000.5);
  });
});

describe('query()', () => {
  it('con la base inalcanzable lanza ServiceUnavailableError (503)', async () => {
    apuntarLaBaseA(PUERTO_SIN_BASE);

    await expect(query('select 1')).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe('checkDb()', () => {
  it('con la base inalcanzable devuelve false, sin lanzar', async () => {
    apuntarLaBaseA(PUERTO_SIN_BASE);

    await expect(checkDb()).resolves.toBe(false);
  });

  it('con la base colgada corta a los 1,5 s y devuelve false', async () => {
    const conexiones: Socket[] = [];
    const baseColgada = createServer((socket) => {
      conexiones.push(socket); // acepta y nunca contesta
    });
    await new Promise<void>((resolve) => baseColgada.listen(0, '127.0.0.1', resolve));
    apuntarLaBaseA((baseColgada.address() as AddressInfo).port);

    const inicio = Date.now();
    const resultado = await checkDb();
    const demora = Date.now() - inicio;

    conexiones.forEach((socket) => socket.destroy());
    baseColgada.close();

    expect(resultado).toBe(false);
    expect(demora).toBeGreaterThanOrEqual(1_400);
    expect(demora).toBeLessThan(2_500);
  });
});
