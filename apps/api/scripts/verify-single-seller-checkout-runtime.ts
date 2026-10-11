import 'reflect-metadata';
import { AuthorizationService } from '../src/common/authorization/authorization.service.js';
import { ApiException } from '../src/common/http/api-exception.js';
import { CheckoutService } from '../src/modules/orders/checkout.service.js';
import { OrdersRepository } from '../src/modules/orders/orders.repository.js';
import type { AuthPrincipal } from '../src/modules/auth/public/index.js';
import type { CheckoutProductSnapshot } from '../src/modules/catalog/public/index.js';

const BUYER_ID = '10000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '10000000-0000-4000-8000-000000000002';
const CART_ID = '10000000-0000-4000-8000-000000000003';
const PRODUCT_A = '20000000-0000-4000-8000-000000000001';
const PRODUCT_B = '20000000-0000-4000-8000-000000000002';
const SELLER_A = '30000000-0000-4000-8000-000000000001';
const SELLER_B = '30000000-0000-4000-8000-000000000002';

const principal: AuthPrincipal = {
  userId: BUYER_ID,
  sessionId: '40000000-0000-4000-8000-000000000001',
  email: 'buyer@example.invalid',
  name: 'the implementation Buyer',
  role: 'BUYER',
};

function product(productId: string, sellerId: string, price: string): CheckoutProductSnapshot {
  return {
    productId,
    sellerId,
    productName: `Product ${productId.slice(-1)}`,
    sku: `SKU-${productId.slice(-4)}`,
    unitPrice: price,
    currency: 'USD',
    availableQuantity: 10,
  };
}

function apiError(error: unknown, status: number, code: string): void {
  if (!(error instanceof ApiException)) throw error;
  if (error.getStatus() !== status) {
    throw new Error(`Expected HTTP ${status}, got ${error.getStatus()}.`);
  }
  const body = error.getResponse();
  if (typeof body !== 'object' || body === null || !('code' in body) || body.code !== code) {
    throw new Error(`Expected error code ${code}, got ${JSON.stringify(body)}.`);
  }
}

async function main(): Promise<void> {
  let sellerChecks = 0;
  let reservations = 0;
  let orderCreates = 0;
  let paymentCreates = 0;
  let cartCloses = 0;
  let idempotencyStores = 0;

  let snapshots = new Map<string, CheckoutProductSnapshot>([
    [PRODUCT_A, product(PRODUCT_A, SELLER_A, '10.00')],
    [PRODUCT_B, product(PRODUCT_B, SELLER_B, '20.00')],
  ]);

  const carts = {
    async findActiveCartSnapshot() {
      return {
        cartId: CART_ID,
        userId: BUYER_ID,
        items: [
          { productId: PRODUCT_A, quantity: 1 },
          { productId: PRODUCT_B, quantity: 1 },
        ],
      };
    },
    async completeCheckoutCart() {
      cartCloses += 1;
    },
  };

  const catalog = {
    async requireCartEligibleProduct() {},
    async checkoutProductSnapshot(productId: string) {
      const row = snapshots.get(productId);
      if (!row) throw new Error(`Unknown product ${productId}`);
      return row;
    },
    async reserveInventory() {
      reservations += 1;
    },
    async releaseInventoryReservation() {},
    async consumeInventoryReservation() {},
    async inventorySnapshot() {
      throw new Error('inventorySnapshot is not used in this verifier');
    },
  };

  const sellers = {
    async requireActiveSeller(userId: string) {
      sellerChecks += 1;
      return { userId, status: 'ACTIVE', storeName: 'Store', slug: 'store' };
    },
  };

  const users = {
    async requireOwnedCheckoutAddress() {
      return {
        addressId: ADDRESS_ID,
        recipient: 'the implementation Buyer',
        line1: '1 Test Street',
        line2: null,
        city: 'Test City',
        region: null,
        postalCode: null,
        country: 'US',
        phone: null,
      };
    },
  };

  const payments = {
    async createPendingCheckoutPayment() {
      paymentCreates += 1;
      throw new Error('Payment creation must not run for a multi-seller checkout.');
    },
  };

  const orders = {
    async createPendingPaymentOrder() {
      orderCreates += 1;
      throw new Error('Order creation must not run for a multi-seller checkout.');
    },
  };

  const transactions = {
    async runSerializable<T>(work: (transaction: unknown) => Promise<T>): Promise<T> {
      return work({ client: {} });
    },
  };

  const idempotency = {
    hashKey(key: string) {
      return `hash:${key}`;
    },
    async findResponse() {
      return null;
    },
    async storeResponse() {
      idempotencyStores += 1;
    },
  };

  const pricingPolicy = {
    calculate() {
      return { shippingMinor: 0n, discountMinor: 0n };
    },
  };

  const service = new CheckoutService(
    new AuthorizationService(),
    transactions as never,
    idempotency as never,
    orders as never,
    carts as never,
    catalog as never,
    sellers as never,
    users as never,
    payments as never,
    pricingPolicy,
    { record: async () => {} } as never,
  );

  let quoteRejected = false;
  try {
    await service.quote(principal);
  } catch (error) {
    apiError(error, 409, 'MULTI_SELLER_CHECKOUT_NOT_SUPPORTED');
    quoteRejected = true;
  }
  if (!quoteRejected) throw new Error('Mixed-seller quote must be rejected.');
  if (sellerChecks !== 0) throw new Error('Seller policy must not run until the one-seller invariant is satisfied.');

  let createRejected = false;
  try {
    await service.create(principal, { shippingAddressId: ADDRESS_ID }, 'checkout-idempotency-key');
  } catch (error) {
    apiError(error, 409, 'MULTI_SELLER_CHECKOUT_NOT_SUPPORTED');
    createRejected = true;
  }
  if (!createRejected) throw new Error('Mixed-seller checkout creation must be rejected.');
  if (reservations !== 0 || orderCreates !== 0 || paymentCreates !== 0 || cartCloses !== 0 || idempotencyStores !== 0) {
    throw new Error(
      `Multi-seller rejection happened too late: reservations=${reservations}, orders=${orderCreates}, payments=${paymentCreates}, cartCloses=${cartCloses}, idempotencyStores=${idempotencyStores}`,
    );
  }

  snapshots = new Map<string, CheckoutProductSnapshot>([
    [PRODUCT_A, product(PRODUCT_A, SELLER_A, '10.00')],
    [PRODUCT_B, product(PRODUCT_B, SELLER_A, '20.00')],
  ]);
  sellerChecks = 0;
  const sameSellerQuote = await service.quote(principal);
  if (sameSellerQuote.sellerId !== SELLER_A || sameSellerQuote.totalAmount !== '30.00') {
    throw new Error(`Same-seller quote failed: ${JSON.stringify(sameSellerQuote)}`);
  }
  if (sellerChecks !== 1) throw new Error(`Expected exactly one ACTIVE-seller policy check, got ${sellerChecks}.`);

  const repository = new OrdersRepository({} as never);
  let prismaOrderCreates = 0;
  const fakeTransaction = {
    client: {
      order: {
        async create() {
          prismaOrderCreates += 1;
          throw new Error('Prisma order.create must not run for mixed-seller item snapshots.');
        },
      },
    },
  };

  let persistenceRejected = false;
  try {
    await repository.createPendingPaymentOrder(
      {
        id: '50000000-0000-4000-8000-000000000001',
        orderNumber: 'TN-checkout',
        buyerId: BUYER_ID,
        paymentExpiresAt: new Date(Date.now() + 30 * 60_000),
        currency: 'USD',
        subtotal: '30.00',
        shippingAmount: '0.00',
        discountAmount: '0.00',
        totalAmount: '30.00',
        shippingAddress: { sourceAddressId: ADDRESS_ID },
        items: [
          {
            productId: PRODUCT_A,
            sellerId: SELLER_A,
            productName: 'A',
            sku: 'A',
            quantity: 1,
            unitPrice: '10.00',
            totalPrice: '10.00',
          },
          {
            productId: PRODUCT_B,
            sellerId: SELLER_B,
            productName: 'B',
            sku: 'B',
            quantity: 1,
            unitPrice: '20.00',
            totalPrice: '20.00',
          },
        ],
      },
      fakeTransaction as never,
    );
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'SINGLE_SELLER_ORDER_INVARIANT_VIOLATION') throw error;
    persistenceRejected = true;
  }
  if (!persistenceRejected) throw new Error('OrdersRepository must reject mixed-seller order-item snapshots.');
  if (prismaOrderCreates !== 0) throw new Error('Persistence invariant must reject before Prisma order.create.');

  console.log('the implementation SINGLE-SELLER CHECKOUT RUNTIME VERIFICATION PASSED');
}

void main();
