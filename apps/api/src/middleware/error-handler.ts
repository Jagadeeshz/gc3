import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiFailure } from '@gc3/types';
import { ApiError } from '../lib/api-error';

/** Terminal 404 for unmatched routes — keeps the response envelope uniform. */
export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(ApiError.notFound(`No route matches ${request.method} ${request.originalUrl}`));
};

/**
 * Single place where an error becomes a response. Unknown errors are logged in
 * full and reported to the client as a generic 500 so internals never leak.
 */
export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const requestId = request.requestId ?? 'unknown';

  if (error instanceof ApiError) {
    const body: ApiFailure = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
        requestId,
      },
    };
    response.status(error.status).json(body);
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`[gc3-api] unhandled error requestId=${requestId}: ${message}`, error);

  const body: ApiFailure = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Quote the request id when contacting support.',
      requestId,
    },
  };
  response.status(500).json(body);
};
