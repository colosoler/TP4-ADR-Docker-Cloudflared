---
name: nodejs-typescript-app
description: Build and structure Node.js backend applications with TypeScript, Express.js, and modern best practices. Use when creating APIs, routes, services, or when the user asks about Node.js project structure, backend architecture, or Express patterns.
---

# Node.js TypeScript Application

## Project Structure

```
backend/
├── routes/                 # Express route handlers
│   ├── index.ts            # Route aggregator
│   ├── upload.ts
│   ├── transform.ts
│   ├── datasets.ts
│   └── workflows.ts
├── services/               # Business logic layer
│   ├── dataService.ts
│   ├── transformService.ts
│   └── profileService.ts
├── utils/                  # Shared utilities
│   ├── dbHelpers.ts        # Database operations
│   ├── queryBuilder.ts     # SQL query construction
│   └── logger.ts           # Logging utility
├── types/                  # TypeScript definitions
│   └── index.ts
├── middleware/             # Express middleware
│   └── errorHandler.ts
├── index.ts                # Application entry point
├── package.json
└── tsconfig.json
```

## TypeScript Configuration

Essential `tsconfig.json` settings:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

## Package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "nodemon --exec ts-node index.ts",
    "lint": "eslint . --ext .ts",
    "test": "jest"
  }
}
```

## Express Application Setup

**index.ts** - Application entry point:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files (for serving frontend build)
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api', routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
```

## Route Handlers Pattern

**routes/index.ts** - Route aggregator:

```typescript
import { Router } from 'express';
import uploadRoutes from './upload';
import transformRoutes from './transform';
import datasetRoutes from './datasets';
import workflowRoutes from './workflows';

const router = Router();

router.use('/upload', uploadRoutes);
router.use('/transform', transformRoutes);
router.use('/datasets', datasetRoutes);
router.use('/workflows', workflowRoutes);

export default router;
```

**routes/datasets.ts** - Feature route file:

```typescript
import { Router, Request, Response, NextFunction } from 'express';
import { datasetService } from '../services/datasetService';
import { logger } from '../utils/logger';

const router = Router();

// Wrap async handlers to catch errors
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const datasets = await datasetService.getAll();
  res.json(datasets);
}));

router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const { datasetName, transformations } = req.body;
  
  if (!datasetName?.trim()) {
    return res.status(400).json({ error: 'Dataset name is required' });
  }
  
  await datasetService.save(datasetName, transformations);
  res.json({ message: 'Dataset saved successfully' });
}));

router.delete('/:fileName', asyncHandler(async (req: Request, res: Response) => {
  const { fileName } = req.params;
  await datasetService.delete(fileName);
  res.json({ message: 'Dataset deleted successfully' });
}));

export default router;
```

## Service Layer Pattern

Services contain business logic, separate from HTTP concerns:

```typescript
// services/datasetService.ts
import { db } from '../utils/dbHelpers';
import { queryBuilder } from '../utils/queryBuilder';
import type { Dataset, Transformation } from '../types';

export const datasetService = {
  async getAll(): Promise<Dataset[]> {
    // Business logic here
    return db.query('SELECT * FROM datasets ORDER BY created_at DESC');
  },

  async save(name: string, transformations: Transformation[]): Promise<void> {
    const query = queryBuilder.buildTransformQuery(transformations);
    await db.execute(query);
    // Save metadata
  },

  async delete(fileName: string): Promise<void> {
    await db.execute('DELETE FROM datasets WHERE file_name = ?', [fileName]);
  },
};
```

## Error Handling Middleware

**middleware/errorHandler.ts**:

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err.message || 'Internal server error';

  logger.error(`${req.method} ${req.path} - ${message}`, {
    stack: err.stack,
    statusCode,
  });

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
```

## Logger Utility

**utils/logger.ts**:

```typescript
import winston from 'winston';

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}${stack ? `\n${stack}` : ''}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'server.log' }),
  ],
});
```

## Type Definitions

**types/index.ts**:

```typescript
export interface Dataset {
  name: string;
  fileName: string;
  createdAt: string;
  rowCount: number;
  columnCount: number;
}

export interface Transformation {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

export interface TransformResult {
  success: boolean;
  rowCount: number;
  columns: string[];
}

// Express request extensions
export interface TypedRequest<T = unknown> extends Express.Request {
  body: T;
}
```

## Database Helpers Pattern

**utils/dbHelpers.ts** (example with DuckDB):

```typescript
import * as duckdb from 'duckdb';
import { logger } from './logger';

let db: duckdb.Database | null = null;
let connection: duckdb.Connection | null = null;

export const initDatabase = (): void => {
  db = new duckdb.Database(':memory:');
  connection = db.connect();
  logger.info('Database initialized');
};

export const query = async <T>(sql: string, params?: unknown[]): Promise<T[]> => {
  if (!connection) throw new Error('Database not initialized');
  
  return new Promise((resolve, reject) => {
    connection!.all(sql, params || [], (err, result) => {
      if (err) reject(err);
      else resolve(result as T[]);
    });
  });
};

export const execute = async (sql: string, params?: unknown[]): Promise<void> => {
  if (!connection) throw new Error('Database not initialized');
  
  return new Promise((resolve, reject) => {
    connection!.run(sql, params || [], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const closeDatabase = (): void => {
  if (connection) connection.close();
  if (db) db.close();
  logger.info('Database closed');
};
```

## Async Handler Pattern

Wrap all async route handlers to catch errors:

```typescript
// Option 1: Utility function
const asyncHandler = (fn: Function) => 
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

// Option 2: express-async-handler package
import asyncHandler from 'express-async-handler';

router.get('/', asyncHandler(async (req, res) => {
  const data = await service.getData();
  res.json(data);
}));
```

## Input Validation

```typescript
router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const { name, data } = req.body;

  // Validate required fields
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!Array.isArray(data)) {
    return res.status(400).json({ error: 'Data must be an array' });
  }

  // Proceed with valid input
  await service.save(name.trim(), data);
  res.json({ message: 'Saved successfully' });
}));
```

## File Upload Handling

```typescript
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_DIR || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx', '.parquet'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${ext} not allowed`));
    }
  },
});

router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // Process file...
}));
```

## Environment Variables

```typescript
// Load at app start
import dotenv from 'dotenv';
dotenv.config();

// Access with defaults
const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  dataDir: process.env.DATA_DIR || './data',
};

export default config;
```

## Dependencies

Essential packages:

```json
{
  "dependencies": {
    "express": "^4.x",
    "cors": "^2.x",
    "dotenv": "^16.x",
    "multer": "^1.x",
    "winston": "^3.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "@types/express": "^4.x",
    "@types/cors": "^2.x",
    "@types/multer": "^1.x",
    "nodemon": "^3.x",
    "ts-node": "^10.x",
    "jest": "^29.x",
    "@types/jest": "^29.x",
    "ts-jest": "^29.x"
  }
}
```

## Testing Pattern

**tests/routes/datasets.test.ts**:

```typescript
import request from 'supertest';
import app from '../../index';
import { datasetService } from '../../services/datasetService';

jest.mock('../../services/datasetService');
const mockedService = datasetService as jest.Mocked<typeof datasetService>;

describe('GET /api/datasets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all datasets', async () => {
    const mockDatasets = [{ name: 'test', fileName: 'test.csv' }];
    mockedService.getAll.mockResolvedValue(mockDatasets);

    const response = await request(app).get('/api/datasets');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockDatasets);
  });
});
```
