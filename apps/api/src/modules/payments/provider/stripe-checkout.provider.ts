import { Injectable } from '@nestjs/common';
import { parseApiEnvironment } from '@tradenest/config';
import { ApiException } from '../../../common/http/api-exception.js';
import {
  stripeAmountMajor, stripeAmountMinor, trustedStripeCheckoutUrl, verifiedStripeSignature, stripeOperationBlockReason,
} from './stripe-checkout-core.js';
import type {
  CreateProviderPaymentInput, CreatedProviderPayment, PaymentProvider,
  RefundedProviderPayment, RefundProviderPaymentInput, VerifiedPaymentEvent, VerifyWebhookInput,
} from './payment-provider.js';

interface StripeCheckoutSession {
  id: string;
  object: string;
  url?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  payment_status?: string;
  payment_intent?: string | null;
}

interface StripeEvent {
  id: string;
  type: string;
  created: number;
  data: { object: StripeCheckoutSession };
}

@Injectable()
export class StripeCheckoutProvider implements PaymentProvider {
  readonly id = 'stripe';
  private readonly config = parseApiEnvironment(process.env);

  private requireConfig() {
    if (!this.config.PAYMENT_STRIPE_SECRET_KEY || !this.config.PAYMENT_STRIPE_WEBHOOK_SECRET ||
      !this.config.PAYMENT_STRIPE_RETURN_ORIGIN) {
      throw new ApiException(503, { code: 'STRIPE_NOT_CONFIGURED', message: 'Stripe payment gateway configuration is incomplete.' });
    }
    return this.config;
  }

  async createPayment(input: CreateProviderPaymentInput): Promise<CreatedProviderPayment> {
    const cfg = this.requireConfig();
    // Block NEW live charges while continuing to verify any already-issued,
    // signed provider webhooks. Financial reconciliation supplies durable reconciliation.
    const blocked = stripeOperationBlockReason(cfg.PAYMENT_STRIPE_SECRET_KEY, 'charge');
    if (blocked) throw new ApiException(503, {
      code: blocked,
      message: 'Live Stripe payment initiation is disabled until production financial reconciliation is approved.',
    });
    let minor: number;
    try { minor = stripeAmountMinor(input.amount, input.currency); }
    catch { throw new ApiException(422, { code: 'STRIPE_CURRENCY_OR_AMOUNT_UNSUPPORTED', message: 'This amount or currency is not supported by the configured payment gateway.' }); }
    const returnOrigin = cfg.PAYMENT_STRIPE_RETURN_ORIGIN!;
    const orderPath = `/orders/${encodeURIComponent(input.orderId)}`;
    const params = new URLSearchParams({
      mode: 'payment',
      success_url: `${returnOrigin}${orderPath}?payment=returned`,
      cancel_url: `${returnOrigin}${orderPath}?payment=cancelled`,
      client_reference_id: input.paymentId,
      'metadata[tradenest_payment_id]': input.paymentId,
      'metadata[tradenest_order_id]': input.orderId,
      'payment_method_types[0]': 'card',
      'line_items[0][price_data][currency]': input.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': String(minor),
      'line_items[0][price_data][product_data][name]': 'TradeNest marketplace order',
      'line_items[0][quantity]': '1',
    });
    const session = await this.request<StripeCheckoutSession>('POST', '/v1/checkout/sessions', params, `tradenest-session-${input.paymentId}`);
    if (!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(session.id) || session.object !== 'checkout.session' ||
      !session.url || !trustedStripeCheckoutUrl(session.url) ||
      session.currency?.toUpperCase() !== input.currency || session.amount_total !== minor) {
      throw this.invalidResponse();
    }
    return { provider: this.id, providerPaymentId: session.id, checkoutUrl: session.url };
  }

  /** Only an OPEN and unpaid Checkout Session can be actively expired.
   * Paid, completed-but-unpaid, or unknown sessions remain reserved for review.
   */
  async expireUnpaidPayment(providerPaymentId: string, amount: string, currency: string): Promise<boolean> {
    this.requireConfig();
    if (!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(providerPaymentId)) throw this.invalidResponse();
    const session = await this.request<StripeCheckoutSession & { status?: string }>('GET', `/v1/checkout/sessions/${providerPaymentId}`);
    if (session.id !== providerPaymentId || session.currency?.toUpperCase() !== currency ||
      session.amount_total !== stripeAmountMinor(amount, currency)) throw this.invalidResponse();
    if (session.status === 'expired' && session.payment_status !== 'paid') return true;
    if (session.status !== 'open' || session.payment_status !== 'unpaid') return false;
    const expired = await this.request<StripeCheckoutSession & { status?: string }>(
      'POST', `/v1/checkout/sessions/${providerPaymentId}/expire`, new URLSearchParams(),
      `tradenest-expire-${providerPaymentId}`,
    );
    return expired.id === providerPaymentId && expired.status === 'expired' && expired.payment_status !== 'paid';
  }

  async refundPayment(input: RefundProviderPaymentInput): Promise<RefundedProviderPayment> {
    const cfg = this.requireConfig();
    // Live money remains fail-closed until locked-runtime, Stripe and settlement
    // acceptance. Test-mode refund dispatch is allowed ONLY from the durable outbox.
    const blocked = stripeOperationBlockReason(cfg.PAYMENT_STRIPE_SECRET_KEY, 'refund');
    if (blocked) throw new ApiException(503, {
      code: blocked,
      message: 'Live Stripe refunds require separate production settlement approval.',
    });
    if (!/^tradenest-refund-[0-9a-f-]{36}$/.test(input.idempotencyKey)) {
      throw new ApiException(422, { code: 'REFUND_OPERATION_ID_REQUIRED', message: 'Durable refund operation reference is required.' });
    }
    let amountMinor: number;
    try { amountMinor = stripeAmountMinor(input.amount, input.currency); }
    catch { throw new ApiException(422, { code: 'STRIPE_REFUND_AMOUNT_INVALID', message: 'Invalid authoritative refund amount or currency.' }); }

    // A Checkout session ID is not a PaymentIntent ID. Resolve the paid session
    // and cross-check currency/amount before querying or creating a refund.
    if (!/^cs_(test_|live_)[A-Za-z0-9]+$/.test(input.providerPaymentId)) throw this.invalidResponse();
    const session = await this.request<StripeCheckoutSession>('GET', `/v1/checkout/sessions/${input.providerPaymentId}`);
    if (session.id !== input.providerPaymentId || session.payment_status !== 'paid' ||
        typeof session.payment_intent !== 'string' || !/^pi_[A-Za-z0-9]+$/.test(session.payment_intent) ||
        session.amount_total !== amountMinor || session.currency?.toUpperCase() !== input.currency) {
      throw this.invalidResponse();
    }
    const intent = session.payment_intent;
    const refundOperationId = input.idempotencyKey.slice('tradenest-refund-'.length);
    const list = await this.request<{
      object: string; has_more: boolean;
      data: Array<{ id: string; object: string; status: string; payment_intent: string; amount: number; currency: string; metadata?: Record<string,string> }>;
    }>('GET', `/v1/refunds?payment_intent=${encodeURIComponent(intent)}&limit=100`);
    if (list.object !== 'list' || !Array.isArray(list.data) || typeof list.has_more !== 'boolean') throw this.invalidResponse();
    const matches = list.data.filter((r) => r.metadata?.tradenest_refund_operation_id === refundOperationId);
    if (matches.length > 1) return { provider: this.id, providerRefundId: null, status: 'NEEDS_REVIEW' };
    if (matches.length === 1) return this.classifyRefund(matches[0]!, intent, amountMinor, input.currency);
    if (list.has_more || input.reconcileOnly) {
      // Never issue a second write if the first request's outcome is uncertain.
      return { provider: this.id, providerRefundId: null, status: 'NEEDS_REVIEW' };
    }
    const params = new URLSearchParams({
      payment_intent: intent,
      amount: String(amountMinor),
      'metadata[tradenest_refund_operation_id]': refundOperationId,
    });
    const created = await this.request<{
      id: string; object: string; status: string; payment_intent: string; amount: number; currency: string;
    }>('POST', '/v1/refunds', params, input.idempotencyKey);
    return this.classifyRefund(created, intent, amountMinor, input.currency);
  }

  private classifyRefund(refund: {
    id: string; object: string; status: string; payment_intent: string; amount: number; currency: string;
  }, intent: string, amount: number, currency: string): RefundedProviderPayment {
    if (!/^re_[A-Za-z0-9]+$/.test(refund.id) || refund.object !== 'refund' ||
      refund.payment_intent !== intent || refund.amount !== amount || refund.currency?.toUpperCase() !== currency) {
      throw this.invalidResponse();
    }
    return { provider: this.id, providerRefundId: refund.id,
      status: refund.status === 'succeeded' ? 'SUCCEEDED' : refund.status === 'pending' ? 'PENDING' : 'NEEDS_REVIEW' };
  }

  verifyWebhook(input: VerifyWebhookInput): VerifiedPaymentEvent | null {
    const cfg = this.requireConfig();
    const rawHeader = input.headers['stripe-signature'];
    const signature = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (!verifiedStripeSignature(input.rawBody, signature, cfg.PAYMENT_STRIPE_WEBHOOK_SECRET!)) {
      throw new ApiException(401, { code: 'PAYMENT_WEBHOOK_SIGNATURE_INVALID', message: 'The payment webhook signature is invalid or expired.' });
    }
    let event: StripeEvent;
    try { event = JSON.parse(input.rawBody.toString('utf8')) as StripeEvent; }
    catch { throw this.invalidPayload(); }
    if (!event || typeof event.id !== 'string' || !/^evt_[A-Za-z0-9]+$/.test(event.id) ||
      typeof event.created !== 'number' || !Number.isSafeInteger(event.created) || !Number.isFinite(event.created) ||
      typeof event.type !== 'string' || typeof event.data?.object !== 'object') throw this.invalidPayload();
    // Card checkout can emit other event types. They are acknowledged without
    // changing financial state; payment_intent.* events MUST NOT double process.
    const success = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded';
    const failed = event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed';
    if (!success && !failed) return null;
    const session = event.data.object;
    if (!session || session.object !== 'checkout.session' || typeof session.id !== 'string' ||
      !/^cs_(test_|live_)[A-Za-z0-9]+$/.test(session.id) ||
      typeof session.currency !== 'string' || typeof session.amount_total !== 'number') throw this.invalidPayload();
    if (success && session.payment_status !== 'paid') return null;
    if (failed && session.payment_status === 'paid') return null;
    const currency = session.currency.toUpperCase();
    let amount: string;
    try { amount = stripeAmountMajor(session.amount_total, currency); }
    catch { throw this.invalidPayload(); }
    return {
      eventId: event.id, provider: this.id, type: success ? 'PAYMENT_SUCCEEDED' : 'PAYMENT_FAILED',
      providerPaymentId: session.id, amount, currency, occurredAt: new Date(event.created * 1000),
      ...(failed ? { failureCode: event.type === 'checkout.session.expired' ? 'SESSION_EXPIRED' : 'ASYNC_PAYMENT_FAILED' } : {}),
    };
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: URLSearchParams, key?: string): Promise<T> {
    const cfg = this.requireConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`https://api.stripe.com${path}`, {
        method, headers: {
          Authorization: `Bearer ${cfg.PAYMENT_STRIPE_SECRET_KEY}`,
          ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
          ...(key ? { 'Idempotency-Key': key } : {}),
        },
        ...(body ? { body: body.toString() } : {}), signal: controller.signal,
      });
      if (!response.ok) {
        // Do not leak Stripe's echoed sensitive request/error content into client logs.
        throw new ApiException(502, { code: 'STRIPE_REQUEST_FAILED', message: 'The payment provider could not complete this request.', details: { httpStatus: response.status } });
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiException) throw error;
      throw new ApiException(503, { code: 'STRIPE_UNAVAILABLE', message: 'The payment provider is temporarily unavailable; retry with the same idempotency key.' });
    } finally { clearTimeout(timeout); }
  }

  private invalidPayload(): ApiException { return new ApiException(400, { code: 'PAYMENT_WEBHOOK_INVALID_PAYLOAD', message: 'The Stripe webhook payload is invalid.' }); }
  private invalidResponse(): ApiException { return new ApiException(502, { code: 'STRIPE_RESPONSE_INVALID', message: 'The payment provider returned inconsistent payment details.' }); }
}
