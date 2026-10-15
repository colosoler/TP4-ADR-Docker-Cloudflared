import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../app';
import { checkDb } from '../db/pool';

vi.mock('../db/pool', () => ({ checkDb: vi.fn() }));

describe('GET /api/health', () => {
  it('con la base arriba responde 200 con db "up"', async () => {
    vi.mocked(checkDb).mockResolvedValue(true);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('con la base caída responde 200 igual, con db "down"', async () => {
    vi.mocked(checkDb).mockResolvedValue(false);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'down' });
  });
});
