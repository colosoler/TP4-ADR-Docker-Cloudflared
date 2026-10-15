import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, type ErrorDetail } from '../errors';
import { logger } from '../logger';

type ErrorBody = { error: { code: string; message: string; details?: ErrorDetail[] } };

function errorBody(code: string, message: string, details?: ErrorDetail[]): ErrorBody {
  return { error: details ? { code, message, details } : { code, message } };
}

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  return undefined;
}

// express.json() lanza un SyntaxError con type 'entity.parse.failed' si el body no es JSON
function isInvalidJson(err: unknown): boolean {
  return err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed';
}

// Traduce cualquier error al formato del contrato (§5.4): { error: { code, message, details? } }.
// Express 5 le pasa también los errores de los handlers async: no hace falta asyncHandler.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorBody(err.code, err.message, err.details));
    return;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    res.status(400).json(errorBody('VALIDATION_ERROR', 'Datos inválidos', details));
    return;
  }
  if (isInvalidJson(err)) {
    res.status(400).json(errorBody('VALIDATION_ERROR', 'El cuerpo no es un JSON válido'));
    return;
  }
  const pgCode = pgErrorCode(err);
  if (pgCode === '23505') {
    res.status(409).json(errorBody('CONFLICT', 'Ya existe un registro con ese valor'));
    return;
  }
  if (pgCode === '23514' || pgCode === '22P02') {
    res.status(400).json(errorBody('VALIDATION_ERROR', 'Datos inválidos'));
    return;
  }
  // El stack va solo al log, nunca a la respuesta
  logger.error('Error no controlado', {
    method: req.method,
    path: req.path,
    stack: err instanceof Error ? err.stack : String(err),
  });
  res.status(500).json(errorBody('INTERNAL_ERROR', 'Error interno del servidor'));
}
