import type { Product, ProductQuery } from '@tradenest/contracts/products';
import type { DatabaseTransactionContext } from '../../../database/database-transaction.service.js';
import type { AuthPrincipal } from '../../auth/public/module-api.js';

export interface CheckoutProductSnapshot {
  productId: string;
  sellerId: string;
  productName: string;
  sku: string;
  unitPrice: string;
  currency: string;
  availableQuantity: number;
}

export interface CatalogInventorySnapshot {
  productId: string;
  availableQuantity: number;
  reservedQuantity: number;
  updatedAt: string;
}



export interface SmartPricingProductContext {
  productId: string;
  sellerId: string;
  categoryId: string;
  currentPrice: string;
  currency: string;
}

export interface SmartPricingComparableProduct {
  productId: string;
  price: string;
  currency: string;
}

export interface RecommendationProductFeature {
  productId: string;
  categoryId: string;
  name: string;
  description: string;
}

/**
 * Explicit CatalogModule inter-module seam.
 *
 * Checkout may pass an opaque database transaction so Catalog remains the sole
 * owner of inventory mutations while those mutations participate in the
 * broader checkout transaction.
 */
export interface CatalogModuleApi {
  adminListProducts(query: ProductQuery): Promise<{ data: Product[]; meta: { page: number; limit: number; total: number; totalPages: number } }>;
  adminSuspendProduct(actor: AuthPrincipal, productId: string, reason: string): Promise<Product>;
  adminReactivateProduct(actor: AuthPrincipal, productId: string, reason: string): Promise<Product>;
  requireCartEligibleProduct(productId: string): Promise<void>;
  requireWishlistEligibleProduct(productId: string): Promise<void>;
  requireBehaviorEventProduct(productId: string): Promise<void>;
  recommendationCandidates(limit: number): Promise<RecommendationProductFeature[]>;
  recommendationProductFeature(productId: string): Promise<RecommendationProductFeature>;
  smartPricingProductContext(principal: AuthPrincipal, productId: string): Promise<SmartPricingProductContext>;
  sellerPricingProductIds(principal: AuthPrincipal, limit: number): Promise<string[]>;
  smartPricingComparableProducts(categoryId: string, currency: string, excludeProductId: string, limit: number): Promise<SmartPricingComparableProduct[]>;
  checkoutProductSnapshot(productId: string, transaction?: DatabaseTransactionContext): Promise<CheckoutProductSnapshot>;
  reserveInventory(productId: string, quantity: number, transaction?: DatabaseTransactionContext): Promise<void>;
  releaseInventoryReservation(productId: string, quantity: number, transaction?: DatabaseTransactionContext): Promise<void>;
  consumeInventoryReservation(productId: string, quantity: number, transaction?: DatabaseTransactionContext): Promise<void>;
  inventorySnapshot(productId: string, transaction?: DatabaseTransactionContext): Promise<CatalogInventorySnapshot>;
}

export const CATALOG_MODULE_API = Symbol('CATALOG_MODULE_API');
