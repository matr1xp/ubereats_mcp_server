/**
 * Error Handler Utility
 */

import { z } from 'zod';
import { createLogger } from './logger.js';

const logger = createLogger('errorHandler');

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    super(`External service error: ${service}`, 503, 'EXTERNAL_SERVICE_ERROR', originalError);
    this.name = 'ExternalServiceError';
  }
}

export class CircuitBreakerError extends AppError {
  constructor(service: string) {
    super(`Service temporarily unavailable: ${service}`, 503, 'CIRCUIT_BREAKER_OPEN');
    this.name = 'CircuitBreakerError';
  }
}

/**
 * Format Zod validation errors
 */
export function formatZodError(error: z.ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  error.errors.forEach((err) => {
    const path = err.path.join('.');
    if (!formatted[path]) {
      formatted[path] = [];
    }
    formatted[path].push(err.message);
  });

  return formatted;
}

/**
 * Handle errors and return standardized error response
 */
export function handleError(error: unknown): {
  status: 'error';
  message: string;
  code?: string;
  details?: any;
} {
  // Log the error
  logger.error({ err: error }, 'Error occurred');

  if (error instanceof AppError) {
    return {
      status: 'error',
      message: error.message,
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 'error',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: formatZodError(error),
    };
  }

  if (error instanceof Error) {
    // Don't expose internal error messages in production
    const message =
      process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message;

    return {
      status: 'error',
      message,
      code: 'INTERNAL_ERROR',
    };
  }

  return {
    status: 'error',
    message: 'An unknown error occurred',
    code: 'UNKNOWN_ERROR',
  };
}

/**
 * Async error wrapper for MCP tools
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(fn: T): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      const handled = handleError(error);
      throw new AppError(handled.message, 500, handled.code, handled.details);
    }
  }) as T;
}
