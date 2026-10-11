import { Injectable } from '@nestjs/common';

export interface CheckoutPricingAdjustments {
  shippingMinor: bigint;
  discountMinor: bigint;
}

export interface CheckoutPricingPolicy {
  calculate(input: { subtotalMinor: bigint; currency: string }): CheckoutPricingAdjustments;
}

export const CHECKOUT_PRICING_POLICY = Symbol('CHECKOUT_PRICING_POLICY');

/**
 * this module implementation decision.
 *
 * The blueprint requires backend-owned shipping/discount calculations but does
 * not define their business rules. Until such rules are explicitly chosen,
 * TradeNest uses zero server-side adjustments. This policy is intentionally
 * replaceable and must never move calculation authority to the browser.
 */
@Injectable()
export class MvpZeroAdjustmentCheckoutPricingPolicy implements CheckoutPricingPolicy {
  calculate(_input: { subtotalMinor: bigint; currency: string }): CheckoutPricingAdjustments {
    return { shippingMinor: 0n, discountMinor: 0n };
  }
}
