import { Router } from 'express';
import { checkDb } from '../db/pool';

export const healthRouter: Router = Router();

// Siempre 200 mientras Node esté vivo: así el healthcheck de Docker no mata al backend
// cuando se cae la base, y el frontend se entera de cuándo volvió
healthRouter.get('/', async (_req, res) => {
  const dbUp = await checkDb();
  res.json({ status: 'ok', db: dbUp ? 'up' : 'down' });
});
