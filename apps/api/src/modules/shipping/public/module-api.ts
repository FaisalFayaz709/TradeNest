import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

export interface ShippingModuleApi {
  markDeliveredFromBuyerConfirmation(
    orderId: string,
    deliveredAt: Date,
    transaction: DatabaseTransactionContext,
  ): Promise<void>;
}

export const SHIPPING_MODULE_API = Symbol('SHIPPING_MODULE_API');
