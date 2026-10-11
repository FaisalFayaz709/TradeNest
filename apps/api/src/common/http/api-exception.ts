import { HttpException } from '@nestjs/common';

export interface ApiExceptionBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiException extends HttpException {
  constructor(status: number, body: ApiExceptionBody) {
    super(body, status);
  }
}
