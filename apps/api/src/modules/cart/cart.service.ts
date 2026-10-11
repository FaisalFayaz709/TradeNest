import { Inject, Injectable } from '@nestjs/common';
import type {
  AddCartItemInput,
  Cart,
  CartItem,
  ClearCartResult,
  DeleteCartItemResult,
  UpdateCartItemInput,
} from '@tradenest/contracts/cart';
import { AuthorizationService } from '../../common/authorization/index.js';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { ApiException } from '../../common/http/api-exception.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { CATALOG_MODULE_API, type CatalogModuleApi } from '../catalog/public/module-api.js';
import { CartRepository } from './cart.repository.js';
import type { CartItemRecord, CartRecord } from './cart.types.js';
import type { ActiveCartSnapshot, CartModuleApi } from './public/module-api.js';

@Injectable()
export class CartService implements CartModuleApi {
  constructor(
    private readonly repository: CartRepository,
    private readonly authorization: AuthorizationService,
    @Inject(CATALOG_MODULE_API) private readonly catalog: CatalogModuleApi,
  ) {}

  async findActiveCartSnapshot(userId: string, transaction?: DatabaseTransactionContext): Promise<ActiveCartSnapshot | null> {
    const cart = await this.repository.findActiveCartByUserId(userId, transaction);
    if (!cart) return null;
    return {
      cartId: cart.id,
      userId: cart.userId,
      items: cart.items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    };
  }

  async completeCheckoutCart(userId: string, cartId: string, transaction: DatabaseTransactionContext): Promise<void> {
    if (!(await this.repository.deactivateCheckoutCart(userId, cartId, transaction))) {
      throw new ApiException(409, {
        code: 'CART_CHECKOUT_CONFLICT',
        message: 'The active cart changed while checkout was being created.',
      });
    }
  }

  async getCart(principal: AuthPrincipal): Promise<Cart> {
    this.requireBuyer(principal);
    return this.toCart(await this.repository.getOrCreateActiveCart(principal.userId));
  }

  async addItem(principal: AuthPrincipal, input: AddCartItemInput): Promise<CartItem> {
    this.requireBuyer(principal);
    await this.catalog.requireCartEligibleProduct(input.productId);
    const cart = await this.repository.getOrCreateActiveCart(principal.userId);
    return this.toItem(await this.repository.addOrIncrementItem(cart.id, input.productId, input.quantity));
  }

  async updateItem(principal: AuthPrincipal, itemId: string, input: UpdateCartItemInput): Promise<CartItem> {
    this.requireBuyer(principal);
    const cart = await this.repository.findActiveCartByUserId(principal.userId);
    if (!cart) throw this.itemNotFound();
    const item = await this.repository.updateItemQuantity(cart.id, itemId, input.quantity);
    if (!item) throw this.itemNotFound();
    return this.toItem(item);
  }

  async deleteItem(principal: AuthPrincipal, itemId: string): Promise<DeleteCartItemResult> {
    this.requireBuyer(principal);
    const cart = await this.repository.findActiveCartByUserId(principal.userId);
    if (!cart || !(await this.repository.deleteItem(cart.id, itemId))) throw this.itemNotFound();
    return { deleted: true };
  }

  async clearCart(principal: AuthPrincipal): Promise<ClearCartResult> {
    this.requireBuyer(principal);
    const cart = await this.repository.findActiveCartByUserId(principal.userId);
    if (cart) await this.repository.clearItems(cart.id);
    return { cleared: true };
  }

  private requireBuyer(principal: AuthPrincipal): void {
    this.authorization.requireRole(principal, ['BUYER']);
  }

  private toCart(row: CartRecord): Cart {
    return {
      id: row.id,
      userId: row.userId,
      items: row.items.map((item) => this.toItem(item)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toItem(row: CartItemRecord): CartItem {
    return {
      id: row.id,
      productId: row.productId,
      quantity: row.quantity,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private itemNotFound(): ApiException {
    return new ApiException(404, {
      code: 'CART_ITEM_NOT_FOUND',
      message: 'The requested cart item was not found.',
    });
  }
}
