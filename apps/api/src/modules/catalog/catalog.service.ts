import { randomUUID as notificationEventId } from 'node:crypto';
import { NOTIFICATIONS_MODULE_API, type NotificationsModuleApi } from '../notifications/public/module-api.js';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { parseApiEnvironment } from '@tradenest/config';
import { DatabaseTransactionService, type DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import type {
  AddProductImageInput,
  Category,
  CreateCategoryInput,
  CreateProductInput,
  Product,
  ProductImage,
  Inventory,
  ProductQuery,
  SellerProductQuery,
  UpdateCategoryInput,
  UpdateInventoryInput,
  UpdateProductInput,
} from '@tradenest/contracts/products';
import type { PaginationMeta } from '@tradenest/contracts/common';
import { AuditService } from '../../common/audit/index.js';
import { StorageService, type UploadRequest } from '../../common/storage/index.js';
import { AuthorizationService } from '../../common/authorization/index.js';
import { ApiException } from '../../common/http/api-exception.js';
import type { AuthPrincipal } from '../auth/public/index.js';
import { SELLER_MODULE_API, type SellerModuleApi } from '../seller/public/module-api.js';
import { CatalogDeleteBlockedRepositoryError } from './catalog.errors.js';
import { CatalogRepository } from './catalog.repository.js';
import type { CategoryRecord, InventoryRecord, ProductImageRecord, ProductRecord } from './catalog.types.js';
import type { CatalogInventorySnapshot, CatalogModuleApi, CheckoutProductSnapshot, RecommendationProductFeature, SmartPricingComparableProduct, SmartPricingProductContext } from './public/module-api.js';

export interface ProductCollection {
  data: Product[];
  meta: PaginationMeta;
}

@Injectable()
export class CatalogService implements CatalogModuleApi {
  private readonly currency = parseApiEnvironment(process.env).CATALOG_DEFAULT_CURRENCY;

  constructor(
    private readonly repository: CatalogRepository,
    private readonly storage: StorageService,
    private readonly authorization: AuthorizationService,
    private readonly transactions: DatabaseTransactionService,
    private readonly audit: AuditService,
    @Inject(NOTIFICATIONS_MODULE_API) private readonly notifications: NotificationsModuleApi,
    @Inject(SELLER_MODULE_API) private readonly sellers: SellerModuleApi,
  ) {}

  async listCategories(): Promise<Category[]> {
    return (await this.repository.listCategories()).map((row) => this.toCategory(row));
  }

  async createCategory(principal: AuthPrincipal, input: CreateCategoryInput): Promise<Category> {
    this.authorization.requireRole(principal, ['ADMIN']);
    if (input.parentId) await this.requireCategory(input.parentId);
    const id = randomUUID();
    return this.transactions.runSerializable(async (transaction) => {
      const created = await this.repository.createCategory({
        id,
        name: input.name.trim(),
        slug: this.stableSlug(input.name, id, 220),
        parentId: input.parentId ?? null,
      }, transaction);
      const result = this.toCategory(created);
      await this.audit.write({
        actorId: principal.userId,
        action: 'CATEGORY_CREATE',
        entityType: 'category',
        entityId: id,
        after: result,
        metadata: { role: principal.role },
      }, transaction);
      return result;
    });
  }

  async updateCategory(principal: AuthPrincipal, id: string, input: UpdateCategoryInput): Promise<Category> {
    this.authorization.requireRole(principal, ['ADMIN']);
    const before = this.toCategory(await this.requireCategory(id));

    if (input.parentId !== undefined) {
      if (input.parentId === id) throw this.categoryCycle();
      if (input.parentId !== null) {
        await this.requireCategory(input.parentId);
        if (await this.wouldCreateCategoryCycle(id, input.parentId)) throw this.categoryCycle();
      }
    }

    return this.transactions.runSerializable(async (transaction) => {
      const updated = await this.repository.updateCategory(id, {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      }, transaction);
      if (!updated) throw this.categoryNotFound();
      const result = this.toCategory(updated);
      await this.audit.write({
        actorId: principal.userId,
        action: 'CATEGORY_UPDATE',
        entityType: 'category',
        entityId: id,
        before,
        after: result,
        metadata: { role: principal.role },
      }, transaction);
      return result;
    });
  }

  async adminListProducts(query: ProductQuery): Promise<ProductCollection> {
    const result = await this.repository.listAdminProducts({ ...(query.q !== undefined ? { q: query.q } : {}), ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}), page: query.page, limit: query.limit });
    return this.page(result.items, result.total, query.page, query.limit);
  }

  async adminSuspendProduct(actor: AuthPrincipal, productId: string, reason: string): Promise<Product> {
    return this.adminChangeProductStatus(actor, productId, 'ACTIVE', 'SUSPENDED', reason);
  }

  async adminReactivateProduct(actor: AuthPrincipal, productId: string, reason: string): Promise<Product> {
    return this.adminChangeProductStatus(actor, productId, 'SUSPENDED', 'ACTIVE', reason);
  }

  private async adminChangeProductStatus(
    actor: AuthPrincipal, productId: string, from: 'ACTIVE' | 'SUSPENDED',
    to: 'ACTIVE' | 'SUSPENDED', reason: string,
  ): Promise<Product> {
    this.authorization.requireRole(actor, ['ADMIN']);
    return this.transactions.runSerializable(async (transaction) => {
      const before = await this.repository.findProductById(productId, transaction);
      if (!before) throw this.productNotFound();
      if (before.status !== from) throw this.invalidProductTransition(before.status, to);
      if (to === 'ACTIVE') await this.sellers.requireActiveSeller(before.sellerId, transaction);
      const updated = await this.repository.transitionProductStatus(productId, from, to, transaction);
      if (!updated) throw this.invalidProductTransition(from, to);
      await this.audit.write({
        actorId: actor.userId, action: to === 'SUSPENDED' ? 'ADMIN_PRODUCT_SUSPEND' : 'ADMIN_PRODUCT_REACTIVATE',
        entityType: 'product', entityId: productId,
        before: { status: from }, after: { status: to }, metadata: { reason },
      }, transaction);
      await this.notifications.record({ key: `PRODUCT_MODERATED:${notificationEventId()}`, type: 'PRODUCT_MODERATED',
        title: to === 'SUSPENDED' ? 'Listing suspended' : 'Listing reactivated',
        body: `An administrator changed your product listing status to ${to.toLowerCase()}.`,
        recipients: [before.sellerId],
      }, transaction);
      return this.toProduct(updated);
    });
  }

  async listPublicProducts(query: ProductQuery): Promise<ProductCollection> {
    const page = await this.repository.listPublicProducts({
      ...(query.q !== undefined ? { q: query.q } : {}),
      ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
      page: query.page,
      limit: query.limit,
    });
    return this.page(page.items, page.total, query.page, query.limit);
  }

  async productBySlug(slug: string): Promise<Product> {
    const product = await this.repository.findPublicProductBySlug(slug);
    if (!product) throw this.productNotFound();
    return this.toProduct(product);
  }

  async listSellerProducts(principal: AuthPrincipal, query: SellerProductQuery): Promise<ProductCollection> {
    this.authorization.requireRole(principal, ['SELLER']);
    const page = await this.repository.listSellerProducts(principal.userId, query);
    return this.page(page.items, page.total, query.page, query.limit);
  }

  async sellerPricingProductIds(principal: AuthPrincipal, limit: number): Promise<string[]> {
    this.authorization.requireRole(principal, ['SELLER']);
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 20);
    const page = await this.repository.listSellerProducts(principal.userId, { page: 1, limit: safeLimit });
    return page.items.map((item) => item.id);
  }

  async createProduct(principal: AuthPrincipal, input: CreateProductInput): Promise<Product> {
    this.authorization.requireRole(principal, ['SELLER']);
    await this.sellers.requireActiveSeller(principal.userId);
    await this.requireCategory(input.categoryId);

    const id = randomUUID();
    const product = await this.repository.createProductWithInventory({
      id,
      sellerId: principal.userId,
      categoryId: input.categoryId,
      name: input.name.trim(),
      slug: this.stableSlug(input.name, id, 240),
      description: input.description.trim(),
      price: input.price.toString(),
      currency: this.currency,
      sku: input.sku.trim(),
      stock: input.stock,
    });
    return this.toProduct(product);
  }

  async updateProduct(principal: AuthPrincipal, id: string, input: UpdateProductInput): Promise<Product> {
    this.authorization.requireRole(principal, ['SELLER']);
    await this.requireOwnedProduct(principal, id, false);
    await this.sellers.requireActiveSeller(principal.userId);
    if (input.categoryId !== undefined) await this.requireCategory(input.categoryId);

    const updated = await this.repository.updateProduct(id, input);
    if (!updated) throw this.productNotFound();
    return this.toProduct(updated);
  }

  async deleteProduct(principal: AuthPrincipal, id: string): Promise<{ deleted: true }> {
    this.authorization.requireRole(principal, ['SELLER', 'ADMIN']);
    const product = await this.requireOwnedProduct(principal, id, true);
    try {
      return await this.transactions.runSerializable(async (transaction) => {
        if (!(await this.repository.deleteProduct(id, transaction))) throw this.productNotFound();
        await this.audit.write({
          actorId: principal.userId,
          action: 'PRODUCT_DELETE',
          entityType: 'product',
          entityId: id,
          before: { id: product.id, sellerId: product.sellerId, status: product.status, sku: product.sku },
          metadata: { role: principal.role },
        }, transaction);
        return { deleted: true as const };
      });
    } catch (error) {
      if (error instanceof CatalogDeleteBlockedRepositoryError) {
        throw new ApiException(409, {
          code: 'PRODUCT_DELETE_BLOCKED',
          message: 'This product cannot be deleted while related marketplace records still reference it.',
        });
      }
      throw error;
    }
  }

  async prepareImageUpload(principal: AuthPrincipal, id: string, input: UploadRequest) {
    this.authorization.requireRole(principal, ['SELLER']);
    await this.requireOwnedProduct(principal, id, false);
    await this.sellers.requireActiveSeller(principal.userId);
    return this.storage.initiate('products', id, principal.userId, input);
  }

  async addProductImage(principal: AuthPrincipal, id: string, input: AddProductImageInput): Promise<ProductImage> {
    this.authorization.requireRole(principal, ['SELLER']);
    await this.requireOwnedProduct(principal, id, false);
    await this.sellers.requireActiveSeller(principal.userId);
    // Ignore untrusted URL metadata: require a real, owner-scoped uploaded object.
    await this.storage.verify('products', id, principal.userId, input.objectKey);
    return this.toImage(await this.repository.addProductImage(id, input));
  }

  async publicProductImage(productId: string, imageId: string) {
    const image = await this.repository.findPublicImage(productId, imageId);
    if (!image) throw new ApiException(404, { code: 'IMAGE_NOT_FOUND', message: 'Image not found.' });
    return this.storage.readPublicProductImage(image.objectKey);
  }

  async updateInventory(principal: AuthPrincipal, id: string, input: UpdateInventoryInput): Promise<Inventory> {
    this.authorization.requireRole(principal, ['SELLER']);
    await this.requireOwnedProduct(principal, id, false);
    await this.sellers.requireActiveSeller(principal.userId);
    const inventory = await this.repository.setAvailableQuantity(id, input.availableQuantity);
    if (!inventory) throw this.inventoryNotFound();
    return this.toInventory(inventory);
  }

  async requireCartEligibleProduct(productId: string): Promise<void> {
    const product = await this.repository.findProductById(productId);
    if (!product || product.status !== 'ACTIVE') throw this.productUnavailable();
    await this.sellers.requireActiveSeller(product.sellerId);
  }


  async requireWishlistEligibleProduct(productId: string): Promise<void> {
    const product = await this.repository.findProductById(productId);
    if (!product) throw this.productNotFound();
    if (product.status !== 'ACTIVE') {
      throw new ApiException(409, {
        code: 'PRODUCT_NOT_AVAILABLE',
        message: 'Only an active public product can be added to a wishlist.',
        details: { productId },
      });
    }
    await this.sellers.requireActiveSeller(product.sellerId);
  }

  async requireBehaviorEventProduct(productId: string): Promise<void> {
    const product = await this.repository.findProductById(productId);
    if (!product) throw this.productNotFound();
    if (product.status !== 'ACTIVE') {
      throw new ApiException(409, {
        code: 'PRODUCT_NOT_AVAILABLE',
        message: 'Behavior events may target only an active public product.',
        details: { productId },
      });
    }
    await this.sellers.requireActiveSeller(product.sellerId);
  }

  async recommendationCandidates(limit: number): Promise<RecommendationProductFeature[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 1000);
    const rows = await this.repository.listRecommendationProducts(safeLimit);
    return rows.map((row) => this.toRecommendationFeature(row));
  }

  async recommendationProductFeature(productId: string): Promise<RecommendationProductFeature> {
    const product = await this.repository.findProductById(productId);
    if (!product || product.status !== 'ACTIVE') throw this.productNotFound();
    await this.sellers.requireActiveSeller(product.sellerId);
    return this.toRecommendationFeature(product);
  }

  async smartPricingProductContext(principal: AuthPrincipal, productId: string): Promise<SmartPricingProductContext> {
    this.authorization.requireRole(principal, ['SELLER']);
    const product = await this.requireOwnedProduct(principal, productId, false);
    if (product.status !== 'ACTIVE') {
      throw new ApiException(409, {
        code: 'PRODUCT_NOT_AVAILABLE',
        message: 'Smart pricing suggestions are available only for active seller products.',
        details: { productId },
      });
    }
    return {
      productId: product.id,
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      currentPrice: this.formatProductPrice(product.price.toString()),
      currency: product.currency,
    };
  }

  async smartPricingComparableProducts(categoryId: string, currency: string, excludeProductId: string, limit: number): Promise<SmartPricingComparableProduct[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
    const rows = await this.repository.listSmartPricingComparables(categoryId, currency, excludeProductId, safeLimit);
    return rows.map((row) => ({ productId: row.id, price: this.formatProductPrice(row.price.toString()), currency: row.currency }));
  }

  async checkoutProductSnapshot(productId: string, transaction?: DatabaseTransactionContext): Promise<CheckoutProductSnapshot> {
    const product = await this.repository.findProductById(productId, transaction);
    if (!product || product.status !== 'ACTIVE') throw this.productUnavailable();
    await this.sellers.requireActiveSeller(product.sellerId, transaction);
    if (!product.inventory) throw this.inventoryNotFound();
    return {
      productId: product.id,
      sellerId: product.sellerId,
      productName: product.name,
      sku: product.sku,
      unitPrice: product.price.toString(),
      currency: product.currency,
      availableQuantity: product.inventory.availableQuantity,
    };
  }

  async inventorySnapshot(productId: string, transaction?: DatabaseTransactionContext): Promise<CatalogInventorySnapshot> {
    const inventory = await this.repository.findInventory(productId, transaction);
    if (!inventory) throw this.inventoryNotFound();
    return this.toInventory(inventory);
  }

  async reserveInventory(productId: string, quantity: number, transaction?: DatabaseTransactionContext): Promise<void> {
    this.requirePositiveInventoryQuantity(quantity);
    const product = await this.repository.findProductById(productId, transaction);
    if (!product || product.status !== 'ACTIVE') throw this.productUnavailable();
    await this.sellers.requireActiveSeller(product.sellerId, transaction);
    if (!(await this.repository.reserveInventory(productId, quantity, transaction))) {
      throw new ApiException(409, {
        code: 'PRODUCT_OUT_OF_STOCK',
        message: 'The requested quantity is not available.',
        details: { productId },
      });
    }
  }

  async releaseInventoryReservation(productId: string, quantity: number, transaction?: DatabaseTransactionContext): Promise<void> {
    this.requirePositiveInventoryQuantity(quantity);
    if (!(await this.repository.releaseInventoryReservation(productId, quantity, transaction))) {
      throw new ApiException(409, {
        code: 'INVALID_INVENTORY_RESERVATION',
        message: 'The requested quantity is not currently reserved.',
        details: { productId },
      });
    }
  }

  async consumeInventoryReservation(productId: string, quantity: number, transaction?: DatabaseTransactionContext): Promise<void> {
    this.requirePositiveInventoryQuantity(quantity);
    if (!(await this.repository.consumeInventoryReservation(productId, quantity, transaction))) {
      throw new ApiException(409, {
        code: 'INVALID_INVENTORY_RESERVATION',
        message: 'The requested quantity is not currently reserved.',
        details: { productId },
      });
    }
  }

  async publishProduct(principal: AuthPrincipal, id: string): Promise<Product> {
    this.authorization.requireRole(principal, ['SELLER']);
    const product = await this.requireOwnedProduct(principal, id, false);
    await this.sellers.requireActiveSeller(principal.userId);
    if (product.status !== 'DRAFT') throw this.invalidProductTransition(product.status, 'ACTIVE');
    const updated = await this.repository.transitionProductStatus(id, 'DRAFT', 'ACTIVE');
    if (!updated) throw this.invalidProductTransition(product.status, 'ACTIVE');
    return this.toProduct(updated);
  }

  async archiveProduct(principal: AuthPrincipal, id: string): Promise<Product> {
    this.authorization.requireRole(principal, ['SELLER']);
    const product = await this.requireOwnedProduct(principal, id, false);
    if (product.status !== 'ACTIVE') throw this.invalidProductTransition(product.status, 'ARCHIVED');
    const updated = await this.repository.transitionProductStatus(id, 'ACTIVE', 'ARCHIVED');
    if (!updated) throw this.invalidProductTransition(product.status, 'ARCHIVED');
    return this.toProduct(updated);
  }

  private async requireOwnedProduct(principal: AuthPrincipal, id: string, allowAdmin: boolean): Promise<ProductRecord> {
    const product = await this.repository.findProductById(id);
    if (!product) throw this.productNotFound();
    this.authorization.requireOwnership(principal, product.sellerId, {
      allowAdmin,
      conceal: true,
      resourceCode: 'PRODUCT_NOT_FOUND',
    });
    return product;
  }

  private async requireCategory(id: string): Promise<CategoryRecord> {
    const category = await this.repository.findCategoryById(id);
    if (!category) throw this.categoryNotFound();
    return category;
  }

  private async wouldCreateCategoryCycle(categoryId: string, candidateParentId: string): Promise<boolean> {
    let current: string | null | undefined = candidateParentId;
    const visited = new Set<string>();
    while (current) {
      if (current === categoryId) return true;
      if (visited.has(current)) return true;
      visited.add(current);
      current = await this.repository.findCategoryParentId(current);
      if (current === undefined) return false;
    }
    return false;
  }

  private page(items: ProductRecord[], total: number, page: number, limit: number): ProductCollection {
    return {
      data: items.map((item) => this.toProduct(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private toCategory(row: CategoryRecord): Category {
    return {
      id: row.id,
      parentId: row.parentId,
      name: row.name,
      slug: row.slug,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toProduct(row: ProductRecord): Product {
    return {
      id: row.id,
      sellerId: row.sellerId,
      categoryId: row.categoryId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      price: row.price.toString(),
      currency: row.currency,
      sku: row.sku,
      status: row.status,
      availableQuantity: row.inventory?.availableQuantity ?? 0,
      images: row.images.map((image) => this.toImage(image)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toImage(row: ProductImageRecord): ProductImage {
    return {
      id: row.id,
      productId: row.productId,
      objectKey: row.objectKey,
      url: row.url,
      sortOrder: row.sortOrder,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private toRecommendationFeature(row: ProductRecord): RecommendationProductFeature {
    return {
      productId: row.id,
      categoryId: row.categoryId,
      name: row.name,
      description: row.description,
    };
  }

  private toInventory(row: InventoryRecord): Inventory {
    return {
      productId: row.productId,
      availableQuantity: row.availableQuantity,
      reservedQuantity: row.reservedQuantity,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private formatProductPrice(value: string): string {
    const [whole, fraction = ''] = value.split('.');
    return `${whole}.${`${fraction}00`.slice(0, 2)}`;
  }

  private requirePositiveInventoryQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1_000_000) {
      throw new ApiException(400, {
        code: 'INVALID_INVENTORY_QUANTITY',
        message: 'Inventory quantity must be a positive integer no greater than 1,000,000.',
      });
    }
  }

  private stableSlug(value: string, id: string, maxLength: number): string {
    const suffix = id.replace(/-/g, '').slice(0, 12).toLowerCase();
    const baseLimit = Math.max(1, maxLength - suffix.length - 1);
    const base = value
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, baseLimit) || 'item';
    return `${base}-${suffix}`;
  }

  private productNotFound(): ApiException {
    return new ApiException(404, { code: 'PRODUCT_NOT_FOUND', message: 'The requested product was not found.' });
  }

  private productUnavailable(): ApiException {
    return new ApiException(409, {
      code: 'PRODUCT_NOT_AVAILABLE',
      message: 'The product is not available for inventory reservation.',
    });
  }

  private inventoryNotFound(): ApiException {
    return new ApiException(409, {
      code: 'INVENTORY_NOT_FOUND',
      message: 'The product inventory record is missing.',
    });
  }

  private categoryNotFound(): ApiException {
    return new ApiException(404, { code: 'CATEGORY_NOT_FOUND', message: 'The requested category was not found.' });
  }

  private categoryCycle(): ApiException {
    return new ApiException(409, { code: 'CATEGORY_CYCLE', message: 'The category parent relationship would create a cycle.' });
  }

  private invalidProductTransition(from: string, to: string): ApiException {
    return new ApiException(409, {
      code: 'INVALID_STATE_TRANSITION',
      message: `Product cannot transition from ${from} to ${to}.`,
      details: { entity: 'product', from, to },
    });
  }
}
