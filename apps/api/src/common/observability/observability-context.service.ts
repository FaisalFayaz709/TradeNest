import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';
import { requestIdFromRequest } from '../http/request-id.js';

interface ObservabilityContext {
  requestId: string;
}

@Injectable()
export class ObservabilityContextService {
  private readonly storage = new AsyncLocalStorage<ObservabilityContext>();

  run<T>(requestId: string, callback: () => T): T {
    return this.storage.run({ requestId }, callback);
  }

  requestId(): string | undefined {
    return this.storage.getStore()?.requestId;
  }
}

export function observabilityContextMiddleware(context: ObservabilityContextService) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    context.run(requestIdFromRequest(request), next);
  };
}
