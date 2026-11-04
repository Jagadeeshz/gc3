import express, { type Express } from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestIdMiddleware, resolveRequestId } from './middleware/request-id';
import { v1Router } from './routes/v1';

/**
 * Express application factory. Kept separate from the server bootstrap so tests
 * and future serverless handlers can mount the same app.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // Correlation id first: every later middleware and error envelope uses it.
  app.use((request, _response, next) => {
    request.requestId = resolveRequestId(request);
    next();
  });
  app.use(requestIdMiddleware);

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));

  // Explicit CORS allow-list; credentials stay off until the auth slice lands.
  app.use((request, response, next) => {
    const origin = request.header('origin');
    const allowed = env.CORS_ORIGINS.split(',').map((value) => value.trim());

    if (origin && allowed.includes(origin)) {
      response.setHeader('access-control-allow-origin', origin);
      response.setHeader('vary', 'Origin');
      response.setHeader(
        'access-control-allow-headers',
        'content-type, authorization, x-organization-id, x-actor-type, x-request-id',
      );
      response.setHeader('access-control-allow-methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    }

    if (request.method === 'OPTIONS') {
      response.status(204).end();
      return;
    }

    next();
  });

  app.use('/api/v1', v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
