import { Injectable } from '@nestjs/common';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { SellerProfileAlreadyExistsRepositoryError } from './seller.errors.js';
import type { SellerProfileRecord } from './seller.types.js';

@Injectable()
export class SellerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, limit: number): Promise<{ rows: SellerProfileRecord[]; total: number }> {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sellerProfile.findMany({ orderBy: [{ createdAt: 'desc' }, { userId: 'desc' }], skip, take: limit }),
      this.prisma.sellerProfile.count(),
    ]);
    return { rows: rows.map((row) => this.map(row)), total };
  }

  async findByUserId(userId: string, transaction?: DatabaseTransactionContext): Promise<SellerProfileRecord | null> {
    const row = await (transaction?.client ?? this.prisma).sellerProfile.findUnique({ where: { userId } });
    return row ? this.map(row) : null;
  }

  async adminTransitionSellerStatus(
    sellerId: string, from: 'ACTIVE' | 'SUSPENDED', to: 'ACTIVE' | 'SUSPENDED',
    transaction: DatabaseTransactionContext,
  ): Promise<SellerProfileRecord | null> {
    const result = await transaction.client.sellerProfile.updateMany({
      where: { userId: sellerId, status: from }, data: { status: to },
    });
    return result.count === 1 ? this.findByUserId(sellerId, transaction) : null;
  }

  async createActiveProfile(userId: string, storeName: string, slug: string): Promise<SellerProfileRecord> {
    try {
      const row = await this.prisma.sellerProfile.create({
        data: {
          userId,
          storeName,
          slug,
          status: 'ACTIVE',
        },
      });
      return this.map(row);
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) {
        throw new SellerProfileAlreadyExistsRepositoryError();
      }
      throw error;
    }
  }

  async updateStoreName(userId: string, storeName: string): Promise<SellerProfileRecord | null> {
    const result = await this.prisma.sellerProfile.updateMany({
      where: { userId },
      data: { storeName },
    });
    if (result.count !== 1) return null;
    return this.findByUserId(userId);
  }

  private map(row: {
    userId: string;
    storeName: string;
    slug: string;
    status: string;
    rating: { toString(): string } | null;
    createdAt: Date;
    updatedAt: Date;
  }): SellerProfileRecord {
    return row;
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }
}
