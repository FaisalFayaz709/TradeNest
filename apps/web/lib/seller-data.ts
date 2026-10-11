import { apiCollection } from './api-client';
import type { OrderSummary, Product } from './api-types';

export async function allSellerProducts(): Promise<Product[]> {
  const first = await apiCollection<Product>('seller/products?page=1&limit=100');
  const rows = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page += 1) rows.push(...(await apiCollection<Product>(`seller/products?page=${page}&limit=100`)).data);
  return rows;
}

export async function allSellerOrders(): Promise<OrderSummary[]> {
  const first = await apiCollection<OrderSummary>('seller/orders?page=1&limit=100');
  const rows = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page += 1) rows.push(...(await apiCollection<OrderSummary>(`seller/orders?page=${page}&limit=100`)).data);
  return rows;
}
