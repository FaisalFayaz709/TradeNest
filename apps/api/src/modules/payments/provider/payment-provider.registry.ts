import { Injectable } from '@nestjs/common';
import { parseApiEnvironment } from '@tradenest/config';
import { ApiException } from '../../../common/http/api-exception.js';
import type { PaymentProvider } from './payment-provider.js';
import { SandboxPaymentProvider } from './sandbox-payment.provider.js';
import { StripeCheckoutProvider } from './stripe-checkout.provider.js';

@Injectable()
export class PaymentProviderRegistry {
  private readonly configuredProvider = parseApiEnvironment(process.env).PAYMENT_PROVIDER;

  constructor(private readonly sandbox: SandboxPaymentProvider, private readonly stripe: StripeCheckoutProvider) {}

  configured(): PaymentProvider {
    return this.byId(this.configuredProvider);
  }

  byId(provider: string): PaymentProvider {
    if (provider === this.sandbox.id) return this.sandbox;
    if (provider === this.stripe.id) return this.stripe;
    throw new ApiException(404, {
      code: 'PAYMENT_PROVIDER_NOT_SUPPORTED',
      message: 'The requested payment provider is not configured.',
      details: { provider },
    });
  }
}
