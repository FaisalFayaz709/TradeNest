import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { CartItemRecord, CartRecord } from './cart.types.js';

@Injectable()
export class CartRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveCartByUserId(userId: string, transaction?: DatabaseTransactionContext): Promise<CartRecord | null> {
    return this.db(transaction).cart.findFirst({
      where: { userId, isActive: true },
      include: { items: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
  }

  async getOrCreateActiveCart(userId: string): Promise<CartRecord> {
    const existing = await this.findActiveCartByUserId(userId);
    if (existing) return existing;

    try {
      return await this.prisma.cart.create({
        data: { userId, isActive: true },
        include: { items: true },
      });
    } catch (error) {
      // The PostgreSQL partial unique index is the final race-safe boundary for
      // one active cart per user. A concurrent creator may win between our read
      // and create, in which case we load that winning cart.
      if (this.hasPrismaCode(error, 'P2002')) {
        const raced = await this.findActiveCartByUserId(userId);
        if (raced) return raced;
      }
      throw error;
    }
  }

  async addOrIncrementItem(cartId: string, productId: string, quantity: number): Promise<CartItemRecord> {
    return this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: { cartId, productId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  async updateItemQuantity(cartId: string, itemId: string, quantity: number): Promise<CartItemRecord | null> {
    const result = await this.prisma.cartItem.updateMany({
      where: { id: itemId, cartId },
      data: { quantity },
    });
    if (result.count !== 1) return null;
    return this.prisma.cartItem.findUnique({ where: { id: itemId } });
  }

  async deleteItem(cartId: string, itemId: string): Promise<boolean> {
    const result = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId } });
    return result.count === 1;
  }

  async clearItems(cartId: string): Promise<void> {
    await this.prisma.cartItem.deleteMany({ where: { cartId } });
  }


  async deactivateCheckoutCart(userId: string, cartId: string, transaction: DatabaseTransactionContext): Promise<boolean> {
    const result = await this.db(transaction).cart.updateMany({
      where: { id: cartId, userId, isActive: true },
      data: { isActive: false },
    });
    return result.count === 1;
  }

  private db(transaction?: DatabaseTransactionContext) {
    return transaction?.client ?? this.prisma;
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }
}
