import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_MAX_LENGTH = 128;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;

export function normalizeRequestId(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (trimmed.length <= REQUEST_ID_MAX_LENGTH && REQUEST_ID_PATTERN.test(trimmed)) return trimmed;
  }
  return randomUUID();
}

export function requestIdMiddleware(request: Request, response: Response, next: NextFunction): void {
  const requestId = normalizeRequestId(request.headers['x-request-id']);
  request.headers['x-request-id'] = requestId;
  response.setHeader('x-request-id', requestId);
  next();
}

export function requestIdFromRequest(request: Pick<Request, 'header'>): string {
  return normalizeRequestId(request.header('x-request-id'));
}

export const REQUEST_ID_LIMIT = REQUEST_ID_MAX_LENGTH;
