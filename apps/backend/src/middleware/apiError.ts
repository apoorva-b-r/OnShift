import { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';

export interface ValidationDetail {
  field: string;
  issue: string;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: ValidationDetail[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const asyncHandler = (
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown
): RequestHandler => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} was not found.`));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
    return res.status(409).json({
      error: 'CONFLICT',
      message: 'A record with the same unique identifier already exists.',
    });
  }

  console.error('Unhandled API error.');
  return res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred.',
  });
};
