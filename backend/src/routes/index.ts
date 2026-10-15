import { Router } from 'express';
import { autosRouter } from '../modules/autos/autos.routes';
import { clientesRouter } from '../modules/clientes/clientes.routes';
import { modelosRouter } from '../modules/modelos/modelos.routes';
import { sucursalesRouter } from '../modules/sucursales/sucursales.routes';
import { vendedoresRouter } from '../modules/vendedores/vendedores.routes';
import { healthRouter } from './health';

// Todo cuelga de /api (ver app.ts). Cada módulo solo toca su archivo de modules/.
export const routes: Router = Router();

routes.use('/health', healthRouter);
routes.use('/modelos', modelosRouter);
routes.use('/clientes', clientesRouter);
routes.use('/autos', autosRouter);
routes.use('/vendedores', vendedoresRouter);
routes.use('/sucursales', sucursalesRouter);
