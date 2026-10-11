import { Injectable } from '@nestjs/common';
import type { AddProductImageInput, ProductStatus, SellerProductQuery, UpdateProductInput } from '@tradenest/contracts/products';
import type { DatabaseTransactionContext } from '../../database/database-transaction.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import { CatalogDeleteBlockedRepositoryError } from './catalog.errors.js';
import type { CategoryRecord, InventoryRecord, ProductImageRecord, ProductPageRecord, ProductRecord } from './catalog.types.js';

interface CreateProductPersistenceInput {
  id: string;
  sellerId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  sku: string;
  stock: number;
}

const PUBLIC_SELLER_POLICY = { seller: { status: 'ACTIVE' as const, sellerProfile: { is: { status: 'ACTIVE' } } } };

interface ProductListInput {
  q?: string;
  categoryId?: string;
  sellerId?: string;
  status?: ProductStatus;
  publicOnly?: boolean;
  page: number;
  limit: number;
}

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<CategoryRecord[]> {
    return this.prisma.category.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] });
  }

  async findCategoryById(id: string, transaction?: DatabaseTransactionContext): Promise<CategoryRecord | null> {
    return this.db(transaction).category.findUnique({ where: { id } });
  }

  async createCategory(input: { id: string; name: string; slug: string; parentId: string | null }, transaction?: DatabaseTransactionContext): Promise<CategoryRecord> {
    return this.db(transaction).category.create({ data: input });
  }

  async updateCategory(id: string, input: { name?: string; parentId?: string | null }, transaction?: DatabaseTransactionContext): Promise<CategoryRecord | null> {
    const result = await this.db(transaction).category.updateMany({ where: { id }, data: input });
    if (result.count !== 1) return null;
    return this.findCategoryById(id, transaction);
  }

  async findCategoryParentId(id: string): Promise<string | null | undefined> {
    const row = await this.prisma.category.findUnique({ where: { id }, select: { parentId: true } });
    return row ? row.parentId : undefined;
  }

  async listAdminProducts(input: ProductListInput): Promise<ProductPageRecord> {
    return this.listProducts({ ...input, publicOnly: false });
  }

  async listPublicProducts(input: ProductListInput): Promise<ProductPageRecord> {
    return this.listProducts({ ...input, publicOnly: true });
  }

  async listSellerProducts(sellerId: string, query: SellerProductQuery): Promise<ProductPageRecord> {
    return this.listProducts({
      ...(query.q !== undefined ? { q: query.q } : {}),
      ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
      sellerId,
      ...(query.status !== undefined ? { status: query.status } : {}),
      page: query.page,
      limit: query.limit,
    });
  }

  async listRecommendationProducts(limit: number): Promise<ProductRecord[]> {
    const rows = await this.prisma.product.findMany({
      where: { status: 'ACTIVE', ...PUBLIC_SELLER_POLICY, inventory: { is: { availableQuantity: { gt: 0 } } } },
      include: { inventory: true, images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map((row) => this.mapProduct(row));
  }

  async listSmartPricingComparables(categoryId: string, currency: string, excludeProductId: string, limit: number): Promise<ProductRecord[]> {
    const rows = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        ...PUBLIC_SELLER_POLICY,
        categoryId,
        currency,
        id: { not: excludeProductId },
      },
      include: { inventory: true, images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map((row) => this.mapProduct(row));
  }

  async findPublicProductBySlug(slug: string): Promise<ProductRecord | null> {
    const row = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE', ...PUBLIC_SELLER_POLICY },
      include: { inventory: true, images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    });
    return row ? this.mapProduct(row) : null;
  }

  async findProductById(id: string, transaction?: DatabaseTransactionContext): Promise<ProductRecord | null> {
    const row = await this.db(transaction).product.findUnique({
      where: { id },
      include: { inventory: true, images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    });
    return row ? this.mapProduct(row) : null;
  }

  async createProductWithInventory(input: CreateProductPersistenceInput): Promise<ProductRecord> {
    await this.prisma.$transaction(async (tx) => {
      await tx.product.create({
        data: {
          id: input.id,
          sellerId: input.sellerId,
          categoryId: input.categoryId,
          name: input.name,
          slug: input.slug,
          description: input.description,
          price: input.price,
          currency: input.currency,
          sku: input.sku,
          status: 'DRAFT',
        },
      });
      await tx.inventory.create({
        data: {
          productId: input.id,
          availableQuantity: input.stock,
          reservedQuantity: 0,
        },
      });
    });
    const created = await this.findProductById(input.id);
    if (!created) throw new Error('Product disappeared after transactional creation.');
    return created;
  }

  async updateProduct(id: string, input: UpdateProductInput): Promise<ProductRecord | null> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.categoryId !== undefined) data.categoryId = input.categoryId;
    if (input.price !== undefined) data.price = input.price.toString();
    if (input.sku !== undefined) data.sku = input.sku;

    const result = await this.prisma.product.updateMany({ where: { id }, data });
    if (result.count !== 1) return null;
    return this.findProductById(id);
  }

  async transitionProductStatus(
    id: string, from: ProductStatus, to: ProductStatus, transaction?: DatabaseTransactionContext,
  ): Promise<ProductRecord | null> {
    const result = await this.db(transaction).product.updateMany({ where: { id, status: from }, data: { status: to } });
    if (result.count !== 1) return null;
    return this.findProductById(id, transaction);
  }

  async deleteProduct(id: string, transaction?: DatabaseTransactionContext): Promise<boolean> {
    try {
      const result = await this.db(transaction).product.deleteMany({ where: { id } });
      return result.count === 1;
    } catch (error) {
      if (this.hasPrismaCode(error, 'P2003')) throw new CatalogDeleteBlockedRepositoryError();
      throw error;
    }
  }

  async findPublicImage(productId: string, imageId: string) {
    return this.prisma.productImage.findFirst({
      where: { id: imageId, productId, product: { status: 'ACTIVE', ...PUBLIC_SELLER_POLICY } },
    });
  }

  async addProductImage(productId: string, input: AddProductImageInput): Promise<ProductImageRecord> {
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
      }
      const created = await tx.productImage.create({
        data: {
          productId,
          objectKey: input.objectKey,
          url: 'pending:managed-image',
          sortOrder: input.sortOrder,
          isPrimary: input.isPrimary,
        },
      });
      return tx.productImage.update({
        where: { id: created.id },
        data: { url: `/api/tradenest/products/${productId}/images/${created.id}/file` },
      });
    });
  }

  async findInventory(productId: string, transaction?: DatabaseTransactionContext): Promise<InventoryRecord | null> {
    return this.db(transaction).inventory.findUnique({ where: { productId } });
  }

  async setAvailableQuantity(productId: string, availableQuantity: number): Promise<InventoryRecord | null> {
    const result = await this.prisma.inventory.updateMany({
      where: { productId },
      data: { availableQuantity },
    });
    if (result.count !== 1) return null;
    return this.findInventory(productId);
  }

  /**
   * Atomic compare-and-update reservation. The WHERE predicate and both
   * quantity mutations execute as one database statement, preventing two
   * concurrent buyers from reserving the same final unit.
   */
  async reserveInventory(productId: string, quantity: number, transaction?: DatabaseTransactionContext): Promise<boolean> {
    const result = await this.db(transaction).inventory.updateMany({
      where: { productId, availableQuantity: { gte: quantity } },
      data: {
        availableQuantity: { decrement: quantity },
        reservedQuantity: { increment: quantity },
      },
    });
    return result.count === 1;
  }

  /** Restore a still-reserved quantity back to sellable inventory atomically. */
  async releaseInventoryReservation(productId: string, quantity: number, transaction?: DatabaseTransactionContext): Promise<boolean> {
    const result = await this.db(transaction).inventory.updateMany({
      where: { productId, reservedQuantity: { gte: quantity } },
      data: {
        availableQuantity: { increment: quantity },
        reservedQuantity: { decrement: quantity },
      },
    });
    return result.count === 1;
  }

  /** Consume a reservation after the reserved units become committed stock. */
  async consumeInventoryReservation(productId: string, quantity: number, transaction?: DatabaseTransactionContext): Promise<boolean> {
    const result = await this.db(transaction).inventory.updateMany({
      where: { productId, reservedQuantity: { gte: quantity } },
      data: { reservedQuantity: { decrement: quantity } },
    });
    return result.count === 1;
  }


  private db(transaction?: DatabaseTransactionContext) {
    return transaction?.client ?? this.prisma;
  }

  private async listProducts(input: ProductListInput): Promise<ProductPageRecord> {
    const where = {
      ...(input.publicOnly ? { status: 'ACTIVE' as const, ...PUBLIC_SELLER_POLICY } : input.status ? { status: input.status } : {}),
      ...(input.sellerId ? { sellerId: input.sellerId } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.q ? {
        OR: [
          { name: { contains: input.q, mode: 'insensitive' as const } },
          { description: { contains: input.q, mode: 'insensitive' as const } },
          { sku: { contains: input.q, mode: 'insensitive' as const } },
        ],
      } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { inventory: true, images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: rows.map((row) => this.mapProduct(row)), total };
  }

  private mapProduct(row: {
    id: string;
    sellerId: string;
    categoryId: string;
    name: string;
    slug: string;
    description: string;
    price: { toString(): string };
    currency: string;
    sku: string;
    status: ProductStatus;
    createdAt: Date;
    updatedAt: Date;
    inventory: { availableQuantity: number; reservedQuantity: number; updatedAt: Date } | null;
    images: ProductImageRecord[];
  }): ProductRecord {
    return { ...row, inventory: row.inventory ? { ...row.inventory, productId: row.id } : null };
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === code;
  }
}
