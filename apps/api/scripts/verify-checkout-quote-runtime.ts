import { strict as assert } from 'node:assert';
import { AuthorizationService } from '../src/common/authorization/authorization.service.js';
import { ApiException } from '../src/common/http/api-exception.js';
import type { AuthPrincipal } from '../src/modules/auth/public/index.js';
import type { CartModuleApi } from '../src/modules/cart/public/index.js';
import type { CatalogModuleApi, CheckoutProductSnapshot } from '../src/modules/catalog/public/index.js';
import { MvpZeroAdjustmentCheckoutPricingPolicy } from '../src/modules/orders/checkout-pricing.policy.js';
import { CheckoutService } from '../src/modules/orders/checkout.service.js';
import type { SellerModuleApi } from '../src/modules/seller/public/index.js';
import type { UsersModuleApi } from '../src/modules/users/public/index.js';
import type { PaymentsModuleApi } from '../src/modules/payments/public/index.js';

const buyer: AuthPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  email: 'buyer@example.test',
  name: 'Buyer',
  role: 'BUYER',
};
const sellerA = '33333333-3333-4333-8333-333333333333';
const sellerB = '44444444-4444-4444-8444-444444444444';
const productA = '55555555-5555-4555-8555-555555555555';
const productB = '66666666-6666-4666-8666-666666666666';
const cartId = '77777777-7777-4777-8777-777777777777';

function makeCatalog(rows: Record<string, CheckoutProductSnapshot>): CatalogModuleApi {
  return {
    async requireCartEligibleProduct() {},
    async checkoutProductSnapshot(productId) {
      const row = rows[productId];
      if (!row) throw new Error('missing fixture');
      return row;
    },
    async reserveInventory() { throw new Error('quote must not reserve inventory'); },
    async releaseInventoryReservation() { throw new Error('quote must not release inventory'); },
    async consumeInventoryReservation() { throw new Error('quote must not consume inventory'); },
    async inventorySnapshot() { throw new Error('quote should use checkoutProductSnapshot'); },
  };
}

function makeSeller(active = true): SellerModuleApi {
  return {
    async requireActiveSeller(userId) {
      if (!active) throw new ApiException(403, { code: 'SELLER_NOT_ACTIVE', message: 'inactive' });
      return { userId, storeName: 'Store', slug: 'store', status: 'ACTIVE' };
    },
  };
}

function makeCart(items: Array<{ productId: string; quantity: number }>): CartModuleApi {
  return {
    async findActiveCartSnapshot(userId) {
      return { cartId, userId, items };
    },
    async completeCheckoutCart() { throw new Error('quote must not close cart'); },
  };
}


const unusedTransactions = { runSerializable: async () => { throw new Error('quote must not open transaction'); } } as never;
const unusedIdempotency = {} as never;
const unusedOrders = {} as never;
const unusedUsers = {} as UsersModuleApi;
const unusedPayments = {} as PaymentsModuleApi;

function checkoutService(cart: CartModuleApi, catalog: CatalogModuleApi, seller: SellerModuleApi): CheckoutService {
  return new CheckoutService(
    new AuthorizationService(),
    unusedTransactions,
    unusedIdempotency,
    unusedOrders,
    cart,
    catalog,
    seller,
    unusedUsers,
    unusedPayments,
    new MvpZeroAdjustmentCheckoutPricingPolicy(),
    { record: async () => {} } as never,
  );
}

async function expectApiCode(run: () => Promise<unknown>, code: string): Promise<void> {
  try {
    await run();
    assert.fail(`Expected ApiException ${code}`);
  } catch (error) {
    assert(error instanceof ApiException);
    const body = error.getResponse();
    assert.equal(typeof body, 'object');
    assert.equal((body as { code?: string }).code, code);
  }
}

async function main(): Promise<void> {
  const products: Record<string, CheckoutProductSnapshot> = {
    [productA]: {
      productId: productA,
      sellerId: sellerA,
      productName: 'Alpha',
      sku: 'A-1',
      unitPrice: '19.95',
      currency: 'USD',
      availableQuantity: 10,
    },
    [productB]: {
      productId: productB,
      sellerId: sellerA,
      productName: 'Beta',
      sku: 'B-1',
      unitPrice: '0.10',
      currency: 'USD',
      availableQuantity: 10,
    },
  };

  const service = checkoutService(makeCart([{ productId: productA, quantity: 2 }, { productId: productB, quantity: 3 }]), makeCatalog(products), makeSeller());
  const quote = await service.quote(buyer);
  assert.equal(quote.subtotalAmount, '40.20');
  assert.equal(quote.shippingAmount, '0.00');
  assert.equal(quote.discountAmount, '0.00');
  assert.equal(quote.totalAmount, '40.20');
  assert.equal(quote.inventoryReserved, false);

  await expectApiCode(
    () => checkoutService(makeCart([]), makeCatalog(products), makeSeller()).quote(buyer),
    'CART_EMPTY',
  );

  await expectApiCode(
    () => checkoutService(makeCart([{ productId: productA, quantity: 11 }]), makeCatalog(products), makeSeller()).quote(buyer),
    'PRODUCT_OUT_OF_STOCK',
  );

  const multiSeller = {
    ...products,
    [productB]: { ...products[productB]!, sellerId: sellerB },
  };
  await expectApiCode(
    () => checkoutService(makeCart([{ productId: productA, quantity: 1 }, { productId: productB, quantity: 1 }]), makeCatalog(multiSeller), makeSeller()).quote(buyer),
    'MULTI_SELLER_CHECKOUT_NOT_SUPPORTED',
  );

  const mixedCurrency = {
    ...products,
    [productB]: { ...products[productB]!, currency: 'EUR' },
  };
  await expectApiCode(
    () => checkoutService(makeCart([{ productId: productA, quantity: 1 }, { productId: productB, quantity: 1 }]), makeCatalog(mixedCurrency), makeSeller()).quote(buyer),
    'MIXED_CURRENCY_CHECKOUT_NOT_SUPPORTED',
  );

  await expectApiCode(
    () => checkoutService(makeCart([{ productId: productA, quantity: 1 }]), makeCatalog(products), makeSeller(false)).quote(buyer),
    'SELLER_NOT_ACTIVE',
  );

  console.log('CHECKOUT QUOTE RUNTIME VERIFICATION PASSED');
}

await main();
