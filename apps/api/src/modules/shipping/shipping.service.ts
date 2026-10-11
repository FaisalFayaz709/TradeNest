import { NOTIFICATIONS_MODULE_API, type NotificationsModuleApi } from '../notifications/public/module-api.js';
import { Inject, Injectable } from '@nestjs/common';
import { CreateShipmentSchema, ShipmentSchema, type CreateShipmentInput, type Shipment } from '@tradenest/contracts/shipping';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { DatabaseTransactionService } from '../../database/database-transaction.service.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { ESCROW_MODULE_API, type EscrowModuleApi } from '../escrow/public/module-api.js';
import { ORDERS_MODULE_API, type OrdersModuleApi } from '../orders/public/module-api.js';
import type { ShippingModuleApi } from './public/module-api.js';
import { ShippingRepository } from './shipping.repository.js';
import { mayCreateShipment, shipmentReplayMatches } from './shipment-policy.js';

@Injectable()
export class ShippingService implements ShippingModuleApi {
  constructor(
    private readonly repository: ShippingRepository,
    private readonly authorization: AuthorizationService,
    private readonly transactions: DatabaseTransactionService,
    @Inject(ORDERS_MODULE_API) private readonly orders: OrdersModuleApi,
    @Inject(NOTIFICATIONS_MODULE_API) private readonly notifications: NotificationsModuleApi,
    @Inject(ESCROW_MODULE_API) private readonly escrow: EscrowModuleApi,
  ) {}

  async createShipment(principal: AuthPrincipal, orderId: string, input: CreateShipmentInput): Promise<Shipment> {
    this.authorization.requireRole(principal, ['SELLER']);
    const body = CreateShipmentSchema.parse(input);

    return this.transactions.runSerializable(async (transaction) => {
      const order = await this.orders.shippingContext(orderId, transaction);
      if (!order) throw this.notFound();
      if (!order.sellerIds.includes(principal.userId)) throw this.notFound();

      const existing = await this.repository.findByOrderId(orderId, transaction);
      if (existing) {
        // A true replay returns the same result; altered tracking details must
        // never be silently accepted as an update to a shipped parcel.
        if (!shipmentReplayMatches(existing, body)) {
          throw new ApiException(409, {
            code: 'SHIPMENT_ALREADY_EXISTS',
            message: 'This order already has a shipment with different tracking details.',
            details: { orderId },
          });
        }
        return this.toShipment(existing);
      }

      if (!['PAID', 'PROCESSING'].includes(order.status)) {
        throw this.invalidTransition(order.status, 'SHIPPED');
      }

      const escrow = await this.escrow.shippingContext(orderId, transaction);
      if (!mayCreateShipment(order.status, escrow?.status ?? null)) {
        throw new ApiException(409, {
          code: 'INVALID_STATE_TRANSITION',
          message: 'The shipment cannot be created unless escrow is held.',
          details: { orderId, escrowStatus: escrow?.status ?? null, requestedStatus: 'SELLER_SHIPPED' },
        });
      }

      const shippedAt = new Date();
      const shipment = await this.repository.createShipped({ orderId, ...body, shippedAt }, transaction);
      await this.orders.markShippedFromShipment(orderId, transaction);
      await this.escrow.markSellerShipped(orderId, transaction);
      await this.notifications.record({ key: `ORDER_SHIPPED:${orderId}`, type: 'ORDER_SHIPPED',
        title: 'Order shipped', body: 'Your seller has created a shipment for your order.',
        recipients: [order.buyerId],
      }, transaction);
      return this.toShipment(shipment);
    });
  }

  async getShipment(principal: AuthPrincipal, orderId: string): Promise<Shipment> {
    this.authorization.requireRole(principal, ['BUYER', 'SELLER']);
    const order = await this.orders.shippingContext(orderId);
    if (!order) throw this.notFound();
    const participant = principal.role === 'BUYER'
      ? order.buyerId === principal.userId
      : order.sellerIds.includes(principal.userId);
    if (!participant) throw this.notFound();
    const shipment = await this.repository.findByOrderId(orderId);
    if (!shipment) throw this.notFound();
    return this.toShipment(shipment);
  }

  async markDeliveredFromBuyerConfirmation(
    orderId: string,
    deliveredAt: Date,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    const shipment = await this.repository.findByOrderId(orderId, transaction);
    if (!shipment) {
      throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION',
        message: 'Delivery cannot be confirmed before a shipment exists.',
        details: { orderId, currentShipmentStatus: null, requestedShipmentStatus: 'DELIVERED' },
      });
    }
    if (shipment.status === 'DELIVERED') return;
    if (shipment.status !== 'SHIPPED') {
      throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION',
        message: 'The shipment cannot transition from its current state.',
        details: { orderId, currentShipmentStatus: shipment.status, requestedShipmentStatus: 'DELIVERED' },
      });
    }
    const changed = await this.repository.markDeliveredByOrderId(orderId, deliveredAt, transaction);
    if (!changed) {
      throw new ApiException(409, {
        code: 'INVALID_STATE_TRANSITION',
        message: 'The shipment could not be marked delivered from its current state.',
        details: { orderId, currentShipmentStatus: shipment.status, requestedShipmentStatus: 'DELIVERED' },
      });
    }
  }

  private toShipment(row: any): Shipment {
    return ShipmentSchema.parse({
      id: row.id,
      orderId: row.orderId,
      carrier: row.carrier,
      trackingCode: row.trackingCode,
      status: row.status,
      shippedAt: row.shippedAt?.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  private notFound(): ApiException {
    return new ApiException(404, { code: 'SHIPMENT_NOT_FOUND', message: 'The requested shipment was not found.' });
  }

  private invalidTransition(currentStatus: string, requestedStatus: string): ApiException {
    return new ApiException(409, {
      code: 'INVALID_STATE_TRANSITION',
      message: 'The order cannot transition from its current state.',
      details: { currentStatus, requestedStatus },
    });
  }
}
