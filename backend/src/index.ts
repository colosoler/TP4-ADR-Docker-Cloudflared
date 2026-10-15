import { app } from './app';
import { config } from './config';
import { logger } from './logger';

app.listen(config.port, (error) => {
  if (error) {
    logger.error('No se pudo levantar el servidor', { message: error.message });
    process.exit(1);
  }
  logger.info(`Backend escuchando en el puerto ${config.port}`);
});
