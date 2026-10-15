import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('escribe una línea con la fecha, el nivel, el mensaje y los datos', () => {
    const consola = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('Backend escuchando', { port: 4000 });

    expect(consola).toHaveBeenCalledOnce();
    expect(consola.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}T\S+ INFO Backend escuchando \{"port":4000\}$/);
  });

  it('los errores también van a stdout (nunca a un archivo)', () => {
    const consola = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.error('Se cayó algo');

    expect(consola).toHaveBeenCalledOnce();
    expect(consola.mock.calls[0][0]).toMatch(/ ERROR Se cayó algo$/);
  });
});
