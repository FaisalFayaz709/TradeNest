import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class ShippingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByOrderId(orderId: string, transaction?: DatabaseTransactionContext) {
    return (transaction?.client ?? this.prisma).shipment.findUnique({ where: { orderId } });
  }

  async createShipped(
    input: { orderId: string; carrier: string; trackingCode: string; shippedAt: Date },
    transaction: DatabaseTransactionContext,
  ) {
    return transaction.client.shipment.create({
      data: {
        orderId: input.orderId,
        carrier: input.carrier,
        trackingCode: input.trackingCode,
        status: 'SHIPPED',
        shippedAt: input.shippedAt,
      },
    });
  }

  async markDeliveredByOrderId(
    orderId: string,
    deliveredAt: Date,
    transaction: DatabaseTransactionContext,
  ): Promise<boolean> {
    const shipment = await transaction.client.shipment.findUnique({
      where: { orderId },
      select: { id: true, status: true },
    });
    if (!shipment) return false;
    if (shipment.status === 'DELIVERED') return true;
    const changed = await transaction.client.shipment.updateMany({
      where: { id: shipment.id, status: 'SHIPPED' },
      data: { status: 'DELIVERED', deliveredAt },
    });
    return changed.count === 1;
  }
}
