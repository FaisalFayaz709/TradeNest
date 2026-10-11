import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = p => readFileSync(resolve(root,p),'utf8');
const checks = [
  ['schema deadline is nullable (legacy safe)','apps/api/prisma/schema.prisma', /paymentExpiresAt DateTime\? @map\("payment_expires_at"\)/],
  ['deadline has an indexed pending-order lookup','apps/api/prisma/schema.prisma', /orders_pending_expiry_idx/],
  ['additive migration is present','apps/api/prisma/migrations/202610080006_checkout_payment_expiration/migration.sql', /ALTER TABLE "orders" ADD COLUMN "payment_expires_at"/],
  ['checkout sets deadline in authoritative transaction','apps/api/src/modules/orders/checkout.service.ts',/paymentExpiresAt: checkoutPaymentDeadline\(\)/],
  ['order listing is bounded and cursor-based','apps/api/src/modules/orders/orders.repository.ts',/listExpiredPendingOrderIds[\s\S]*orderBy: \{ id: 'asc' \}/],
  ['conditional cancellation compares expiration deadline','apps/api/src/modules/orders/orders.repository.ts',/expiredAt \? \{ paymentExpiresAt: \{ lte: expiredAt \} \}/],
  ['worker locks order before payment check','apps/api/src/modules/orders/order-expiration.service.ts',/lockById\(orderId, transaction\)[\s\S]*orderCancellationContext\(orderId, transaction\)/],
  ['external pending payments are never auto-expired','apps/api/src/modules/orders/order-expiration.service.ts',/if \(payment.externalPending\) return 'PROVIDER_PENDING'/],
  ['stock released only after cancellation compare-and-update','apps/api/src/modules/orders/order-expiration.service.ts',/cancelPendingPaymentOrder\(orderId, asOf, transaction, asOf\)[\s\S]*if \(!changed\) return 'SKIPPED';[\s\S]*releaseInventoryReservation/],
  ['payment initiation checks deadline under order lock','apps/api/src/modules/payments/payments.service.ts', /order.paymentExpiresAt[\s\S]*ORDER_PAYMENT_EXPIRED/],
  ['webhook requires payment-eligible order before success mutation','apps/api/src/modules/payments/payments.service.ts', /const verifiedOrder = await this.orders.paymentContext\(current.orderId, transaction\);[\s\S]*PAYMENT_RECONCILIATION_REQUIRED[\s\S]*markSucceeded/],
  ['expiration service belongs to monolithic OrdersModule','apps/api/src/modules/orders/orders.module.ts', /OrderExpirationService/],
  ['DB test exercises actual NestJS service','apps/api/scripts/verify-checkout-expiration-runtime.ts', /app.get\(OrderExpirationService\)/],
];
const failed=checks.filter(([label,path,regex])=>!existsSync(resolve(root,path))||!regex.test(read(path))).map(([label])=>label);
if(failed.length){console.error('CHECKOUT STATIC FAILURE:',failed.join('; '));process.exit(1);}
console.log(`CHECKOUT SOURCE GATE PASSED: ${checks.length} checkout, expiration, locking and reconciliation boundaries.`);
console.log('Does not certify a live PostgreSQL/Node 24 run.');
