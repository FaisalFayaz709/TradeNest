import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiException, type ApiExceptionBody } from './api-exception.js';
import { requestIdFromRequest } from './request-id.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const requestId = requestIdFromRequest(request);

    const { status, body } = this.normalize(exception);
    response.setHeader('x-request-id', requestId);
    const retryAfter = body.details?.retryAfterSeconds;
    if (status === 429 && typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter > 0) {
      response.setHeader('Retry-After', String(Math.ceil(retryAfter)));
    }
    response.status(status).json({
      error: {
        code: body.code,
        message: body.message,
        details: body.details ?? {},
        requestId,
      },
    });
  }


  private normalize(exception: unknown): { status: number; body: ApiExceptionBody } {
    if (exception instanceof ApiException) {
      return {
        status: exception.getStatus(),
        body: exception.getResponse() as ApiExceptionBody,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message = typeof response === 'string'
        ? response
        : typeof response === 'object' && response !== null && 'message' in response
          ? this.messageFromUnknown((response as { message?: unknown }).message)
          : exception.message;
      return {
        status,
        body: {
          code: `HTTP_${status}`,
          message,
          details: {},
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        details: {},
      },
    };
  }

  private messageFromUnknown(value: unknown): string {
    if (Array.isArray(value)) return value.map(String).join('; ');
    return typeof value === 'string' ? value : 'Request failed.';
  }
}
