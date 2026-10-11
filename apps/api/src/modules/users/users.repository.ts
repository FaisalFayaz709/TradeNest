import { Injectable } from '@nestjs/common';
import type { CreateAddressInput, UpdateAddressInput } from '@tradenest/contracts/users';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { AccountDeletionBlockedRepositoryError } from './users.errors.js';
import type { AddressRecord, UserProfileRecord, WishlistItemRecord } from './users.types.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(page: number, limit: number): Promise<{ rows: UserProfileRecord[]; total: number }> {
    const skip = (page - 1) * limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip, take: limit }),
      this.prisma.user.count(),
    ]);
    return { rows: rows.map((row) => this.mapUser(row)), total };
  }

  async findUserById(userId: string, transaction?: DatabaseTransactionContext): Promise<UserProfileRecord | null> {
    const user = await (transaction?.client ?? this.prisma).user.findUnique({ where: { id: userId } });
    return user ? this.mapUser(user) : null;
  }

  async adminTransitionUserStatus(
    userId: string, from: 'ACTIVE' | 'SUSPENDED', to: 'ACTIVE' | 'SUSPENDED',
    transaction: DatabaseTransactionContext,
  ): Promise<UserProfileRecord | null> {
    const result = await transaction.client.user.updateMany({
      where: { id: userId, status: from, role: { not: 'ADMIN' } }, data: { status: to },
    });
    return result.count === 1 ? this.findUserById(userId, transaction) : null;
  }

  async revokeUserSessions(userId: string, transaction: DatabaseTransactionContext): Promise<void> {
    await transaction.client.userSession.updateMany({
      where: { userId, revokedAt: null }, data: { revokedAt: new Date() },
    });
  }

  async updateUserName(userId: string, name: string): Promise<UserProfileRecord | null> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { name },
    });
    if (result.count !== 1) return null;
    return this.findUserById(userId);
  }

  async deleteUser(userId: string): Promise<boolean> {
    try {
      const result = await this.prisma.user.deleteMany({ where: { id: userId } });
      return result.count === 1;
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2003')) throw new AccountDeletionBlockedRepositoryError();
      throw error;
    }
  }

  async listAddresses(userId: string): Promise<AddressRecord[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => this.mapAddress(row));
  }

  async findAddressById(addressId: string, transaction?: DatabaseTransactionContext): Promise<AddressRecord | null> {
    const row = await (transaction?.client ?? this.prisma).address.findUnique({ where: { id: addressId } });
    return row ? this.mapAddress(row) : null;
  }

  async createAddress(userId: string, input: CreateAddressInput): Promise<AddressRecord> {
    const row = await this.prisma.address.create({
      data: {
        userId,
        recipient: input.recipient,
        line1: input.line1,
        city: input.city,
        country: input.country,
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
        ...(input.region !== undefined ? { region: input.region } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    });
    return this.mapAddress(row);
  }

  async updateAddress(addressId: string, input: UpdateAddressInput): Promise<AddressRecord | null> {
    const result = await this.prisma.address.updateMany({
      where: { id: addressId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.recipient !== undefined ? { recipient: input.recipient } : {}),
        ...(input.line1 !== undefined ? { line1: input.line1 } : {}),
        ...(input.line2 !== undefined ? { line2: input.line2 } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.region !== undefined ? { region: input.region } : {}),
        ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      },
    });
    if (result.count !== 1) return null;
    return this.findAddressById(addressId);
  }

  async deleteAddress(addressId: string): Promise<boolean> {
    const result = await this.prisma.address.deleteMany({ where: { id: addressId } });
    return result.count === 1;
  }



  async listWishlist(userId: string): Promise<WishlistItemRecord[]> {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async findWishlistItem(userId: string, productId: string): Promise<WishlistItemRecord | null> {
    return this.prisma.wishlistItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });
  }

  async createWishlistItem(userId: string, productId: string): Promise<WishlistItemRecord> {
    return this.prisma.wishlistItem.create({ data: { userId, productId } });
  }

  async deleteWishlistItem(userId: string, productId: string): Promise<boolean> {
    const result = await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return result.count === 1;
  }

  private mapUser(user: {
    id: string;
    email: string;
    name: string;
    role: 'BUYER' | 'SELLER' | 'ADMIN';
    status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
    emailVerifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfileRecord {
    return user;
  }

  private mapAddress(row: AddressRecord): AddressRecord {
    return row;
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }
}
