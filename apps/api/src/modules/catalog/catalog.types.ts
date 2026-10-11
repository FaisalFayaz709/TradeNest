import type { ProductStatus } from '@tradenest/contracts/products';

export interface CategoryRecord {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductImageRecord {
  id: string;
  productId: string;
  objectKey: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
}

export interface InventoryRecord {
  productId: string;
  availableQuantity: number;
  reservedQuantity: number;
  updatedAt: Date;
}

export interface ProductRecord {
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
  inventory: InventoryRecord | null;
  images: ProductImageRecord[];
}

export interface ProductPageRecord {
  items: ProductRecord[];
  total: number;
}
