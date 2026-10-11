import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

export interface CheckoutCartItemSnapshot {
  productId: string;
  quantity: number;
}

export interface ActiveCartSnapshot {
  cartId: string;
  userId: string;
  items: CheckoutCartItemSnapshot[];
}

/**
 * Public inter-module contract for CartModule.
 *
 * Cart remains convenience state only. This seam exposes product identity and
 * quantity to checkout coordination; it deliberately exposes no prices, totals,
 * inventory promises, or reservation operations.
 */
export interface CartModuleApi {
  findActiveCartSnapshot(userId: string, transaction?: DatabaseTransactionContext): Promise<ActiveCartSnapshot | null>;
  completeCheckoutCart(userId: string, cartId: string, transaction: DatabaseTransactionContext): Promise<void>;
}

export const CART_MODULE_API = Symbol('CART_MODULE_API');
