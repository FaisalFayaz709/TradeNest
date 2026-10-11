import { Injectable } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { parseApiEnvironment } from '@tradenest/config';
import { SandboxPaymentWebhookSchema } from '@tradenest/contracts/payments';
import { ApiException } from '../../../common/http/api-exception.js';
import type {
  CreateProviderPaymentInput,
  CreatedProviderPayment,
  PaymentProvider,
  RefundedProviderPayment,
  RefundProviderPaymentInput,
  VerifiedPaymentEvent,
  VerifyWebhookInput,
} from './payment-provider.js';

@Injectable()
export class SandboxPaymentProvider implements PaymentProvider {
  readonly id = 'sandbox';
  private readonly secret = parseApiEnvironment(process.env).PAYMENT_SANDBOX_WEBHOOK_SECRET;

  async createPayment(input: CreateProviderPaymentInput): Promise<CreatedProviderPayment> {
    // Deterministic on the application payment ID so retries remain provider-idempotent.
    return {
      provider: this.id,
      providerPaymentId: `sandbox_${input.paymentId}`,
    };
  }

  async refundPayment(input: RefundProviderPaymentInput): Promise<RefundedProviderPayment> {
    // Deterministic on payment + idempotency key, mirroring a provider-side idempotent refund request.
    const suffix = createHash('sha256').update(`${input.paymentId}:${input.idempotencyKey}`, 'utf8').digest('hex').slice(0, 24);
    return {
      provider: this.id,
      providerRefundId: `sandbox_refund_${input.paymentId}_${suffix}`,
      status: 'SUCCEEDED',
    };
  }

  verifyWebhook(input: VerifyWebhookInput): VerifiedPaymentEvent {
    const header = input.headers['x-tradenest-signature'];
    const signature = Array.isArray(header) ? header[0] : header;
    if (!signature) throw this.invalidSignature();

    const suppliedHex = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;
    const expectedHex = createHmac('sha256', this.secret).update(input.rawBody).digest('hex');

    if (!/^[a-fA-F0-9]{64}$/.test(suppliedHex)) throw this.invalidSignature();
    const supplied = Buffer.from(suppliedHex, 'hex');
    const expected = Buffer.from(expectedHex, 'hex');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw this.invalidSignature();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(input.rawBody.toString('utf8'));
    } catch {
      throw new ApiException(400, {
        code: 'PAYMENT_WEBHOOK_INVALID_PAYLOAD',
        message: 'The payment webhook body is not valid JSON.',
      });
    }

    const payload = SandboxPaymentWebhookSchema.safeParse(parsedJson);
    if (!payload.success) {
      throw new ApiException(400, {
        code: 'PAYMENT_WEBHOOK_INVALID_PAYLOAD',
        message: 'The payment webhook payload is invalid.',
      });
    }

    return {
      eventId: payload.data.eventId,
      provider: this.id,
      type: payload.data.type,
      providerPaymentId: payload.data.providerPaymentId,
      amount: payload.data.amount,
      currency: payload.data.currency,
      occurredAt: new Date(payload.data.occurredAt),
      ...(payload.data.failureCode ? { failureCode: payload.data.failureCode } : {}),
      ...(payload.data.failureMessage ? { failureMessage: payload.data.failureMessage } : {}),
    };
  }

  private invalidSignature(): ApiException {
    return new ApiException(401, {
      code: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID',
      message: 'The payment webhook signature is invalid.',
    });
  }
}
