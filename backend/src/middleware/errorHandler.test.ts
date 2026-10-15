import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ConflictError, NotFoundError, ServiceUnavailableError } from '../errors';
import { logger } from '../logger';
import { errorHandler } from './errorHandler';

// App mínima: un POST que ejecuta `lanzar` y, al final, el errorHandler
function appQueLanza(lanzar: () => unknown): Express {
  const app = express();
  app.use(express.json());
  app.post('/', () => {
    lanzar();
  });
  app.use(errorHandler);
  return app;
}

function pgError(code: string): Error {
  return Object.assign(new Error(`error de Postgres ${code}`), { code });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  it('ZodError → 400 VALIDATION_ERROR con details', async () => {
    const schema = z.object({ dni: z.string().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos') });

    const res = await request(appQueLanza(() => schema.parse({ dni: '123' }))).post('/').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: [{ path: 'dni', message: 'El DNI debe tener 7 u 8 dígitos' }],
      },
    });
  });

  it('pg 23505 → 409 CONFLICT', async () => {
    const res = await request(appQueLanza(() => { throw pgError('23505'); })).post('/').send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'CONFLICT', message: 'Ya existe un registro con ese valor' } });
  });

  it('ServiceUnavailableError → 503 DB_UNAVAILABLE', async () => {
    const res = await request(appQueLanza(() => { throw new ServiceUnavailableError(); })).post('/').send({});

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'DB_UNAVAILABLE', message: 'La base de datos no está disponible. Reintentá en unos segundos.' },
    });
  });

  it("Error('boom') → 500 INTERNAL_ERROR, sin stack en el body (el stack va al log)", async () => {
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});

    const res = await request(appQueLanza(() => { throw new Error('boom'); })).post('/').send({});

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
    expect(res.text).not.toContain('boom');
    expect(logError).toHaveBeenCalledOnce();
    expect(JSON.stringify(logError.mock.calls[0])).toContain('Error: boom');
  });

  it('NotFoundError → 404 NOT_FOUND con su mensaje', async () => {
    const res = await request(appQueLanza(() => { throw new NotFoundError('Cliente no encontrado'); })).post('/').send({});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Cliente no encontrado' } });
  });

  it('ConflictError → 409 CONFLICT con su mensaje', async () => {
    const res = await request(appQueLanza(() => { throw new ConflictError('Ya existe un cliente con ese DNI'); })).post('/').send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'CONFLICT', message: 'Ya existe un cliente con ese DNI' } });
  });

  it.each(['23514', '22P02'])('pg %s → 400 VALIDATION_ERROR', async (code) => {
    const res = await request(appQueLanza(() => { throw pgError(code); })).post('/').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' } });
  });

  it('JSON mal formado → 400 "El cuerpo no es un JSON válido"', async () => {
    const res = await request(appQueLanza(() => undefined))
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"dni": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'El cuerpo no es un JSON válido' } });
  });
});
