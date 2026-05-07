import { ApiError } from '../api';

export const isNetworkError = (error: unknown): error is ApiError =>
  error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.status === 0);

export const isRetryableNetworkError = (error: unknown): error is ApiError =>
  error instanceof ApiError &&
  (error.status === 0 ||
    error.status === 429 ||
    error.status === 502 ||
    error.status === 503 ||
    error.status === 504 ||
    error.code === 'NETWORK_ERROR' ||
    Boolean(error.code?.startsWith('AI_')));

export const isAiUnavailableError = (error: unknown): error is ApiError =>
  error instanceof ApiError && (error.status === 503 || Boolean(error.code?.startsWith('AI_')));
