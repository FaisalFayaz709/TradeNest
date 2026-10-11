import { Inject, Injectable } from '@nestjs/common';
import { NOTIFICATIONS_MODULE_API, type NotificationsModuleApi } from '../notifications/public/module-api.js';
import { randomUUID } from 'node:crypto';
import {
  CheckoutCreatedSchema,
  CheckoutIdempotencyKeySchema,
  type CheckoutCreated,
  type CheckoutOrderItem,
  type CheckoutQuote,
  type CheckoutQuoteItem,
  type CreateCheckoutInput,
} from '@tradenest/contracts/checkout';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import { FinancialIdempotencyService } from '../../common/idempotency/index.js';
import { DatabaseTransactionService, type DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { CART_MODULE_API, type CartModuleApi } from '../cart/public/module-api.js';
import { CATALOG_MODULE_API, type CatalogModuleApi, type CheckoutProductSnapshot } from '../catalog/public/module-api.js';
import { PAYMENTS_MODULE_API, type PaymentsModuleApi } from '../payments/public/module-api.js';
import { SELLER_MODULE_API, type SellerModuleApi } from '../seller/public/module-api.js';
import { USERS_MODULE_API, type UsersModuleApi } from '../users/public/module-api.js';
import {
  CHECKOUT_PRICING_POLICY,
  type CheckoutPricingPolicy,
} from './checkout-pricing.policy.js';
import { OrdersRepository, type CheckoutOrderRecord } from './orders.repository.js';
import { checkoutPaymentDeadline } from './checkout-expiration.policy.js';

interface ValidatedCheckoutLine {
  product: CheckoutProductSnapshot;
  quantity: number;
  unitMinor: bigint;
  lineMinor: bigint;
}

@Injectable()
export class CheckoutService {
  private readonly checkoutOperation = 'CHECKOUT_CREATE';

  constructor(
    private readonly authorization: AuthorizationService,
    private readonly transactions: DatabaseTransactionService,
    private readonly idempotency: FinancialIdempotencyService,
    private readonly orders: OrdersRepository,
    @Inject(CART_MODULE_API) private readonly carts: CartModuleApi,
    @Inject(CATALOG_MODULE_API) private readonly catalog: CatalogModuleApi,
    @Inject(SELLER_MODULE_API) private readonly sellers: SellerModuleApi,
    @Inject(USERS_MODULE_API) private readonly users: UsersModuleApi,
    @Inject(PAYMENTS_MODULE_API) private readonly payments: PaymentsModuleApi,
    @Inject(CHECKOUT_PRICING_POLICY) private readonly pricingPolicy: CheckoutPricingPolicy,
    @Inject(NOTIFICATIONS_MODULE_API) private readonly notifications: NotificationsModuleApi,
  ) {}

  async quote(principal: AuthPrincipal): Promise<CheckoutQuote> {
    this.authorization.requireRole(principal, ['BUYER']);

    const cart = await this.carts.findActiveCartSnapshot(principal.userId);
    if (!cart || cart.items.length === 0) throw this.cartEmpty();

    const productRows = await Promise.all(
      cart.items.map(async (item) => ({
        cartItem: item,
        product: await this.catalog.checkoutProductSnapshot(item.productId),
      })),
    );

    const sellerId = this.requireSingleSeller(productRows.map(({ product }) => product));
    await this.sellers.requireActiveSeller(sellerId);
    const currency = this.requireSingleCurrency(productRows.map(({ product }) => product));

    let subtotalMinor = 0n;
    const items: CheckoutQuoteItem[] = productRows.map(({ cartItem, product }) => {
      this.assertStock(product, cartItem.quantity);
      const unitMinor = this.parseMoney(product.unitPrice);
      const lineMinor = unitMinor * BigInt(cartItem.quantity);
      subtotalMinor += lineMinor;
      return {
        productId: product.productId,
        sellerId: product.sellerId,
        productName: product.productName,
        sku: product.sku,
        quantity: cartItem.quantity,
        unitPrice: this.formatMoney(unitMinor),
        lineTotal: this.formatMoney(lineMinor),
      };
    });

    const totals = this.calculateTotals(subtotalMinor, currency);
    return {
      cartId: cart.cartId,
      sellerId,
      currency,
      items,
      ...totals,
      inventoryReserved: false,
    };
  }

  async create(
    principal: AuthPrincipal,
    input: CreateCheckoutInput,
    rawIdempotencyKey: string | undefined,
  ): Promise<CheckoutCreated> {
    this.authorization.requireRole(principal, ['BUYER']);
    const idempotencyKey = this.requireIdempotencyKey(rawIdempotencyKey);
    const idempotency = this.idempotency.prepare(idempotencyKey, { shippingAddressId: input.shippingAddressId });

    const replay = await this.idempotency.replayOrThrow<unknown>(principal.userId, this.checkoutOperation, idempotency);
    if (replay) return CheckoutCreatedSchema.parse(replay);

    try {
      return await this.transactions.runSerializable(async (transaction) => {
        const transactionReplay = await this.idempotency.claimOrReplay<unknown>(
          principal.userId,
          this.checkoutOperation,
          idempotency,
          transaction,
        );
        if (transactionReplay) return CheckoutCreatedSchema.parse(transactionReplay);

        const cart = await this.carts.findActiveCartSnapshot(principal.userId, transaction);
        if (!cart || cart.items.length === 0) throw this.cartEmpty();

        const address = await this.users.requireOwnedCheckoutAddress(
          principal.userId,
          input.shippingAddressId,
          transaction,
        );

        const productRows: Array<{ product: CheckoutProductSnapshot; quantity: number }> = [];
        for (const item of cart.items) {
          productRows.push({
            product: await this.catalog.checkoutProductSnapshot(item.productId, transaction),
            quantity: item.quantity,
          });
        }

        const sellerId = this.requireSingleSeller(productRows.map(({ product }) => product));
        await this.sellers.requireActiveSeller(sellerId, transaction);
        const currency = this.requireSingleCurrency(productRows.map(({ product }) => product));

        let subtotalMinor = 0n;
        const lines: ValidatedCheckoutLine[] = productRows.map(({ product, quantity }) => {
          this.assertStock(product, quantity);
          const unitMinor = this.parseMoney(product.unitPrice);
          const lineMinor = unitMinor * BigInt(quantity);
          subtotalMinor += lineMinor;
          return { product, quantity, unitMinor, lineMinor };
        });

        const totals = this.calculateTotals(subtotalMinor, currency);

        for (const line of lines) {
          await this.catalog.reserveInventory(line.product.productId, line.quantity, transaction);
        }

        const orderId = randomUUID();
        const order = await this.orders.createPendingPaymentOrder(
          {
            id: orderId,
            paymentExpiresAt: checkoutPaymentDeadline(),
            orderNumber: this.orderNumber(orderId),
            buyerId: principal.userId,
            currency,
            subtotal: totals.subtotalAmount,
            shippingAmount: totals.shippingAmount,
            discountAmount: totals.discountAmount,
            totalAmount: totals.totalAmount,
            shippingAddress: {
              sourceAddressId: address.addressId,
              recipient: address.recipient,
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              region: address.region,
              postalCode: address.postalCode,
              country: address.country,
              phone: address.phone,
            },
            items: lines.map((line) => ({
              productId: line.product.productId,
              sellerId: line.product.sellerId,
              productName: line.product.productName,
              sku: line.product.sku,
              quantity: line.quantity,
              unitPrice: this.formatMoney(line.unitMinor),
              totalPrice: this.formatMoney(line.lineMinor),
            })),
          },
          transaction,
        );

        const payment = await this.payments.createPendingCheckoutPayment(
          {
            orderId: order.id,
            buyerId: principal.userId,
            amount: totals.totalAmount,
            currency,
          },
          transaction,
        );

        await this.carts.completeCheckoutCart(principal.userId, cart.cartId, transaction);
        await this.notifications.record({ key: `ORDER_PLACED:${orderId}`, type: 'ORDER_PLACED',
          title: 'New order awaiting payment', body: 'An order was placed and is awaiting verified payment.',
          recipients: [principal.userId, sellerId],
        }, transaction);

        const result = this.toCheckoutCreated(order, payment);
        await this.idempotency.complete(
          principal.userId,
          this.checkoutOperation,
          idempotency,
          result,
          transaction,
        );
        return result;
      });
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) {
        const concurrentReplay = await this.idempotency.replayOrThrow<unknown>(
          principal.userId,
          this.checkoutOperation,
          idempotency,
        );
        if (concurrentReplay) return CheckoutCreatedSchema.parse(concurrentReplay);
      }
      throw error;
    }
  }

  private toCheckoutCreated(
    order: CheckoutOrderRecord,
    payment: { id: string; status: 'PENDING'; amount: string; currency: string },
  ): CheckoutCreated {
    const items: CheckoutOrderItem[] = order.items.map((item) => ({
      productId: item.productId,
      sellerId: item.sellerId,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: this.normalizeMoney(item.unitPrice.toString()),
      totalPrice: this.normalizeMoney(item.totalPrice.toString()),
    }));

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: 'PENDING_PAYMENT',
        currency: order.currency,
        subtotalAmount: this.normalizeMoney(order.subtotal.toString()),
        shippingAmount: this.normalizeMoney(order.shippingAmount.toString()),
        discountAmount: this.normalizeMoney(order.discountAmount.toString()),
        totalAmount: this.normalizeMoney(order.totalAmount.toString()),
        items,
      },
      payment: {
        id: payment.id,
        status: 'PENDING',
        amount: this.normalizeMoney(payment.amount),
        currency: payment.currency,
      },
      inventoryReserved: true,
      cartClosed: true,
    };
  }

  private calculateTotals(subtotalMinor: bigint, currency: string) {
    const adjustments = this.pricingPolicy.calculate({ subtotalMinor, currency });
    if (adjustments.shippingMinor < 0n || adjustments.discountMinor < 0n) {
      throw new Error('Checkout pricing policy returned a negative adjustment.');
    }
    const totalMinor = subtotalMinor + adjustments.shippingMinor - adjustments.discountMinor;
    if (totalMinor < 0n) throw new Error('Checkout pricing policy produced a negative total.');
    return {
      subtotalAmount: this.formatMoney(subtotalMinor),
      shippingAmount: this.formatMoney(adjustments.shippingMinor),
      discountAmount: this.formatMoney(adjustments.discountMinor),
      totalAmount: this.formatMoney(totalMinor),
    };
  }

  private requireSingleSeller(products: CheckoutProductSnapshot[]): string {
    const sellerIds = new Set(products.map((product) => product.sellerId));
    if (sellerIds.size !== 1) {
      throw new ApiException(409, {
        code: 'MULTI_SELLER_CHECKOUT_NOT_SUPPORTED',
        message: 'The MVP supports one seller per order. Split the cart by seller before checkout.',
      });
    }
    return products[0]!.sellerId;
  }

  private requireSingleCurrency(products: CheckoutProductSnapshot[]): string {
    const currencies = new Set(products.map((product) => product.currency));
    if (currencies.size !== 1) {
      throw new ApiException(409, {
        code: 'MIXED_CURRENCY_CHECKOUT_NOT_SUPPORTED',
        message: 'All products in an order must use the same currency.',
      });
    }
    return products[0]!.currency;
  }

  private assertStock(product: CheckoutProductSnapshot, quantity: number): void {
    if (product.availableQuantity < quantity) {
      throw new ApiException(409, {
        code: 'PRODUCT_OUT_OF_STOCK',
        message: 'The requested quantity is not available.',
        details: { productId: product.productId },
      });
    }
  }

  private requireIdempotencyKey(raw: string | undefined): string {
    const parsed = CheckoutIdempotencyKeySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'A valid Idempotency-Key header is required for checkout.',
      });
    }
    return parsed.data;
  }

  private orderNumber(orderId: string): string {
    return `TN-${orderId.replace(/-/g, '').toUpperCase()}`;
  }

  private cartEmpty(): ApiException {
    return new ApiException(409, {
      code: 'CART_EMPTY',
      message: 'The cart must contain at least one item before checkout.',
    });
  }

  private normalizeMoney(value: string): string {
    return this.formatMoney(this.parseMoney(value));
  }

  private parseMoney(value: string): bigint {
    const normalized = value.trim();
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
    if (!match) throw new Error(`Unsupported authoritative money value: ${value}`);
    const whole = BigInt(match[1]!);
    const fraction = (match[2] ?? '').padEnd(2, '0');
    return whole * 100n + BigInt(fraction || '0');
  }

  private formatMoney(minor: bigint): string {
    const whole = minor / 100n;
    const fraction = (minor % 100n).toString().padStart(2, '0');
    return `${whole}.${fraction}`;
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }
}
