import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { parseApiEnvironment } from '@tradenest/config';
import type { Request, Response } from 'express';
import { performance } from 'node:perf_hooks';
import type { Observable } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
import { requestIdFromRequest } from '../http/request-id.js';
import { MetricsService } from './metrics.service.js';
import { OperationalLoggerService } from './operational-logger.service.js';

@Injectable()
export class HttpObservabilityInterceptor implements NestInterceptor {
  private readonly slowRequestMs = parseApiEnvironment(process.env).OBSERVABILITY_SLOW_REQUEST_MS;

  constructor(
    private readonly metrics: MetricsService,
    private readonly logger: OperationalLoggerService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = requestIdFromRequest(request);
    const method = String(request.method || 'UNKNOWN').toUpperCase();
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    const startedAt = performance.now();
    let completed = false;

    this.metrics.beginHttpRequest();

    const complete = (statusCode: number, error?: unknown): void => {
      if (completed) return;
      completed = true;
      const durationMs = Math.max(0, performance.now() - startedAt);
      this.metrics.recordHttpRequest(method, handler, statusCode, durationMs);

      const fields = {
        requestId,
        method,
        handler,
        statusCode,
        durationMs: Number(durationMs.toFixed(3)),
        slow: durationMs >= this.slowRequestMs,
      };

      if (error !== undefined || statusCode >= 500) this.logger.error('http.request.completed', fields, error);
      else if (durationMs >= this.slowRequestMs || statusCode >= 400) this.logger.warn('http.request.completed', fields);
      else this.logger.info('http.request.completed', fields);
    };

    return next.handle().pipe(
      tap({
        error: (error: unknown) => complete(this.statusFrom(error), error),
      }),
      finalize(() => complete(response.statusCode)),
    );
  }

  private statusFrom(error: unknown): number {
    return error instanceof HttpException ? error.getStatus() : 500;
  }
}
