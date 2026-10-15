export type ErrorDetail = { path: string; message: string };

// Error "esperado": el errorHandler responde con su statusCode, code y message
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// new NotFoundError('Cliente no encontrado') → 404
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

// new ConflictError('Ya existe un cliente con ese DNI') → 409
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

// La base no responde → 503. Lo lanza query() de db/pool.ts.
export class ServiceUnavailableError extends AppError {
  constructor() {
    super(503, 'DB_UNAVAILABLE', 'La base de datos no está disponible. Reintentá en unos segundos.');
  }
}
