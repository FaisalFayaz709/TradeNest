import { Inject, Injectable } from '@nestjs/common';
import type { DeleteWishlistItemResult, WishlistItem } from '@tradenest/contracts/wishlist';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { CATALOG_MODULE_API, type CatalogModuleApi } from '../catalog/public/module-api.js';
import { UsersRepository } from './users.repository.js';
import type { WishlistItemRecord } from './users.types.js';

@Injectable()
export class WishlistService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly authorization: AuthorizationService,
    @Inject(CATALOG_MODULE_API) private readonly catalog: CatalogModuleApi,
  ) {}

  async list(principal: AuthPrincipal): Promise<WishlistItem[]> {
    this.authorization.requireRole(principal, ['BUYER']);
    return (await this.repository.listWishlist(principal.userId)).map((row) => this.toItem(row));
  }

  async add(principal: AuthPrincipal, productId: string): Promise<WishlistItem> {
    this.authorization.requireRole(principal, ['BUYER']);
    await this.catalog.requireWishlistEligibleProduct(productId);

    const existing = await this.repository.findWishlistItem(principal.userId, productId);
    if (existing) return this.toItem(existing);

    try {
      return this.toItem(await this.repository.createWishlistItem(principal.userId, productId));
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2002')) {
        const winner = await this.repository.findWishlistItem(principal.userId, productId);
        if (winner) return this.toItem(winner);
      }
      throw error;
    }
  }

  async remove(principal: AuthPrincipal, productId: string): Promise<DeleteWishlistItemResult> {
    this.authorization.requireRole(principal, ['BUYER']);
    if (!(await this.repository.deleteWishlistItem(principal.userId, productId))) {
      throw new ApiException(404, {
        code: 'WISHLIST_ITEM_NOT_FOUND',
        message: 'The requested wishlist item was not found.',
      });
    }
    return { deleted: true, productId };
  }

  private toItem(row: WishlistItemRecord): WishlistItem {
    return {
      id: row.id,
      productId: row.productId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }
}
