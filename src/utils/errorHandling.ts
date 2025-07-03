import { AppError } from '../types';

const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'auth/invalid-credentials',
  SESSION_EXPIRED: 'auth/session-expired',
  UNAUTHORIZED: 'auth/unauthorized',
  INVALID_TOKEN: 'auth/invalid-token',
} as const;

const API_ERRORS = {
  NETWORK_ERROR: 'api/network-error',
  SERVER_ERROR: 'api/server-error',
  VALIDATION_ERROR: 'api/validation-error',
  NOT_FOUND: 'api/not-found',
} as const;

const PRODUCTION_ERRORS = {
  INVALID_DATE: 'production/invalid-date',
  INVALID_QUANTITY: 'production/invalid-quantity',
  PLAN_NOT_FOUND: 'production/plan-not-found',
  SAVE_FAILED: 'production/save-failed',
} as const;

export const ErrorCodes = {
  ...AUTH_ERRORS,
  ...API_ERRORS,
  ...PRODUCTION_ERRORS,
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.INVALID_CREDENTIALS]: 'Invalid username or password',
  [ErrorCodes.SESSION_EXPIRED]: 'Your session has expired. Please log in again',
  [ErrorCodes.UNAUTHORIZED]: 'You are not authorized to perform this action',
  [ErrorCodes.INVALID_TOKEN]: 'Invalid authentication token',
  [ErrorCodes.NETWORK_ERROR]: 'Unable to connect to the server',
  [ErrorCodes.SERVER_ERROR]: 'An unexpected server error occurred',
  [ErrorCodes.VALIDATION_ERROR]: 'Invalid data provided',
  [ErrorCodes.NOT_FOUND]: 'The requested resource was not found',
  [ErrorCodes.INVALID_DATE]: 'Invalid production date',
  [ErrorCodes.INVALID_QUANTITY]: 'Invalid production quantity',
  [ErrorCodes.PLAN_NOT_FOUND]: 'Production plan not found',
  [ErrorCodes.SAVE_FAILED]: 'Failed to save production plan',
};

export class AppErrorHandler {
  static createError(code: ErrorCode, details?: unknown): AppError {
    return {
      code,
      message: ErrorMessages[code] || 'An unknown error occurred',
      details,
    };
  }

  static handleAuthError(error: unknown): AppError {
    if (error instanceof Error) {
      if (error.message.includes('Invalid login credentials')) {
        return this.createError(ErrorCodes.INVALID_CREDENTIALS);
      }
      if (error.message.includes('Session expired')) {
        return this.createError(ErrorCodes.SESSION_EXPIRED);
      }
      if (error.message.includes('Invalid token')) {
        return this.createError(ErrorCodes.INVALID_TOKEN);
      }
    }
    return this.createError(ErrorCodes.UNAUTHORIZED);
  }

  static handleApiError(error: unknown): AppError {
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('Network error')) {
        return this.createError(ErrorCodes.NETWORK_ERROR);
      }
      if (error.message.includes('404')) {
        return this.createError(ErrorCodes.NOT_FOUND);
      }
      if (error.message.includes('validation')) {
        return this.createError(ErrorCodes.VALIDATION_ERROR);
      }
    }
    return this.createError(ErrorCodes.SERVER_ERROR);
  }

  static isAuthError(error: AppError): boolean {
    return error.code.startsWith('auth/');
  }

  static isNetworkError(error: AppError): boolean {
    return error.code === ErrorCodes.NETWORK_ERROR;
  }

  static isValidationError(error: AppError): boolean {
    return error.code === ErrorCodes.VALIDATION_ERROR;
  }
} 