import { Controller, Param, Post, Req, type RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentProviderIdentifierSchema } from '@tradenest/contracts/common';
import { ZodValidationPipe } from '../../common/http/zod-validation.pipe.js';
import { ApiException } from '../../common/http/api-exception.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':provider')
  async receive(
    @Param('provider', new ZodValidationPipe(PaymentProviderIdentifierSchema)) provider: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (!request.rawBody) {
      throw new ApiException(500, { code: 'PAYMENT_WEBHOOK_RAW_BODY_UNAVAILABLE', message: 'Webhook raw-body capture is not enabled.' });
    }
    const sourceIp = request.ip || request.socket.remoteAddress || 'unknown';
    return { data: await this.payments.handleWebhook(provider, request.rawBody, request.headers, sourceIp) };
  }
}
