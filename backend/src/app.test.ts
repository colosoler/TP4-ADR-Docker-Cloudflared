import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app';

describe('app', () => {
  it('una ruta que no existe responde 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
  });

  it('un body que no es JSON responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Content-Type', 'application/json')
      .send('{"nombre": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'El cuerpo no es un JSON válido' } });
  });

  it('no expone el header x-powered-by', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
