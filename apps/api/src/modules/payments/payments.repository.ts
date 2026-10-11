import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';

export interface PaymentRecord {
  id: string;
  orderId: string;
  buyerId: string;
  provider: string;
  providerPaymentId: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  amount: { toString(): string };
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PendingPaymentRecord {
  id: string;
  orderId: string;
  status: 'PENDING';
  amount: { toString(): string };
  currency: string;
}

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, limit: number): Promise<{ rows: PaymentRecord[]; total: number }> {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }),
      this.prisma.payment.count(),
    ]);
    return { rows: rows as PaymentRecord[], total };
  }

  async createPendingCheckoutPayment(
    input: { orderId: string; buyerId: string; amount: string; currency: string },
    transaction: DatabaseTransactionContext,
  ): Promise<PendingPaymentRecord> {
    const id = randomUUID();
    const row = await transaction.client.payment.create({
      data: {
        id,
        orderId: input.orderId,
        buyerId: input.buyerId,
        provider: 'INTERNAL_PENDING',
        providerPaymentId: `internal_pending_${id}`,
        status: 'PENDING',
        amount: input.amount,
        currency: input.currency,
      },
      select: { id: true, orderId: true, amount: true, currency: true },
    });
    return { ...row, status: 'PENDING' };
  }

  async findById(id: string, transaction?: DatabaseTransactionContext): Promise<PaymentRecord | null> {
    return (transaction?.client ?? this.prisma).payment.findUnique({ where: { id } }) as Promise<PaymentRecord | null>;
  }

  async findByProviderPaymentId(
    provider: string,
    providerPaymentId: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<PaymentRecord | null> {
    const row = await (transaction?.client ?? this.prisma).payment.findUnique({
      where: { providerPaymentId },
    }) as PaymentRecord | null;
    return row?.provider === provider ? row : null;
  }

  async findLatestForOrder(orderId: string, transaction?: DatabaseTransactionContext): Promise<PaymentRecord | null> {
    return (transaction?.client ?? this.prisma).payment.findFirst({
      where: { orderId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }) as Promise<PaymentRecord | null>;
  }

  async initializePendingPayment(
    paymentId: string,
    provider: string,
    providerPaymentId: string,
    transaction: DatabaseTransactionContext,
  ): Promise<PaymentRecord> {
    return transaction.client.payment.update({
      where: { id: paymentId },
      data: { provider, providerPaymentId },
    }) as Promise<PaymentRecord>;
  }

  async createProviderPendingPayment(
    input: {
      id: string;
      orderId: string;
      buyerId: string;
      provider: string;
      providerPaymentId: string;
      amount: string;
      currency: string;
    },
    transaction: DatabaseTransactionContext,
  ): Promise<PaymentRecord> {
    return transaction.client.payment.create({
      data: { ...input, status: 'PENDING' },
    }) as Promise<PaymentRecord>;
  }

  async markSucceeded(paymentId: string, paidAt: Date, transaction: DatabaseTransactionContext): Promise<void> {
    const result = await transaction.client.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'SUCCEEDED', paidAt, failureCode: null, failureMessage: null },
    });
    if (result.count !== 1) throw new Error('PAYMENT_SUCCEEDED_COMPARE_AND_UPDATE_FAILED');
  }

  async markFailed(
    paymentId: string,
    failureCode: string | null,
    failureMessage: string | null,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    const result = await transaction.client.payment.updateMany({
      where: { id: paymentId, status: 'PENDING' },
      data: { status: 'FAILED', failureCode, failureMessage },
    });
    if (result.count !== 1) throw new Error('PAYMENT_FAILED_COMPARE_AND_UPDATE_FAILED');
  }
}
