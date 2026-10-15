import express, { type Express } from 'express';
import { NotFoundError } from './errors';
import { errorHandler } from './middleware/errorHandler';
import { routes } from './routes';

// Se exporta sin listen (eso lo hace index.ts) para poder testearla con Supertest.
// Sin cors(): el navegador habla siempre con un único origen, el proxy.
export const app: Express = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api', routes);
app.use((_req, _res, next) => {
  next(new NotFoundError('Ruta no encontrada'));
});
app.use(errorHandler);
