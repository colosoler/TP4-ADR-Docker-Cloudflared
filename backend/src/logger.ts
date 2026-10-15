type Level = 'info' | 'error';
type LogData = Record<string, unknown>;

// Todo va a stdout: el contenedor es de solo lectura y Docker junta la salida
// (docker compose logs backend). Nunca pasar DNI, emails ni bodies en `data`.
function write(level: Level, message: string, data?: LogData): void {
  const extra = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`${new Date().toISOString()} ${level.toUpperCase()} ${message}${extra}`);
}

export const logger = {
  info: (message: string, data?: LogData): void => write('info', message, data),
  error: (message: string, data?: LogData): void => write('error', message, data),
};
