import { Pool, types } from 'pg';
import { ServiceUnavailableError } from '../errors';
import { logger } from '../logger';

// Sin esto, pg devuelve los bigint (ids) y los numeric (precios) como texto
types.setTypeParser(types.builtins.INT8, (v) => Number(v));
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));

// Los datos de conexión salen de PGHOST, PGPORT, PGDATABASE, PGUSER y PGPASSWORD (los lee pg solo).
// Timeouts cortos: con la base caída, la request falla en ~3 s en vez de quedarse colgada.
// El pool no se exporta: todo el acceso a la base pasa por query().
const pool = new Pool({
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 3_000,
  query_timeout: 10_000,
});

// Sin este listener, un error en una conexión inactiva (por ejemplo, porque se cayó la base)
// mata todo el proceso de Node
pool.on('error', (err) => {
  logger.error('Se cortó una conexión inactiva con la base', { message: err.message });
});

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
  '57P01', // admin_shutdown: apagaron la base
  '57P03', // cannot_connect_now: la base está arrancando
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08006', // connection_failure
]);

const CONNECTION_ERROR_MESSAGES = [
  'Connection terminated',
  'timeout exceeded when trying to connect',
  'Query read timeout',
];

export function isConnectionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ('code' in err && typeof err.code === 'string' && CONNECTION_ERROR_CODES.has(err.code)) {
    return true;
  }
  const message = 'message' in err && typeof err.message === 'string' ? err.message : '';
  return CONNECTION_ERROR_MESSAGES.some((texto) => message.includes(texto));
}

// Usar SIEMPRE esto, nunca pool.query directo: si no, la caída de la base da 500 en vez de 503
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (err) {
    if (isConnectionError(err)) throw new ServiceUnavailableError();
    throw err;
  }
}

const CHECK_DB_TIMEOUT_MS = 1_500;

// Para /api/health: true o false, nunca lanza y nunca tarda más de 1,5 s
export async function checkDb(): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), CHECK_DB_TIMEOUT_MS);
  });
  const ping = pool.query('select 1').then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([ping, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
