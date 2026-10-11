import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';

/** The only cross-domain entry point. Caller supplies a transaction committed
 * alongside the corresponding authoritative state change. */
export interface NotificationEvent {
  key: string;
  type: 'ORDER_PLACED' | 'ORDER_CANCELLED' | 'ORDER_COMPLETED' | 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' |
    'ORDER_SHIPPED' | 'DISPUTE_OPENED' | 'DISPUTE_RESOLVED' | 'REFUND_COMPLETED' |
    'ACCOUNT_MODERATED' | 'SELLER_MODERATED' | 'PRODUCT_MODERATED';
  title: string;
  body: string;
  recipients: readonly string[];
}
export interface NotificationsModuleApi {
  record(event: NotificationEvent, transaction: DatabaseTransactionContext): Promise<void>;
}
export const NOTIFICATIONS_MODULE_API = Symbol('NOTIFICATIONS_MODULE_API');
