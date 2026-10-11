import { ApiSuccessEnvelopeSchema, StandardErrorSchema } from '@tradenest/contracts/common';
import type { ApiErrorShape, PaginationMeta, Product } from './api-types';

export class TradeNestApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly requestId?: string;

  constructor(status: number, payload: ApiErrorShape, fallback: string) {
    super(payload.error?.message || fallback);
    this.name = 'TradeNestApiError';
    this.status = status;
    this.code = payload.error?.code || 'REQUEST_FAILED';
    this.details = payload.error?.details || {};
    this.requestId = payload.error?.requestId;
  }
}

export type ApiCollection<T> = { data: T[]; meta: PaginationMeta };
export type ApiData<T> = { data: T };

function normalizedPath(path: string): string {
  return path.replace(/^\/+/, '');
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  headers.set('accept', 'application/json');

  const response = await fetch(`/api/tradenest/${normalizedPath(path)}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (!response.ok) throw new Error(`TradeNest API returned HTTP ${response.status}.`);
      throw new Error('TradeNest API returned an unreadable response.');
    }
  }

  if (!response.ok) {
    throw new TradeNestApiError(
      response.status,
      StandardErrorSchema.parse(payload) as ApiErrorShape,
      `TradeNest API request failed with HTTP ${response.status}.`,
    );
  }
  return ApiSuccessEnvelopeSchema.parse(payload) as unknown as T;
}

export async function apiData<T>(path: string, init: RequestInit = {}): Promise<T> {
  return (await apiRequest<ApiData<T>>(path, init)).data;
}

export async function apiCollection<T>(path: string): Promise<ApiCollection<T>> {
  return apiRequest<ApiCollection<T>>(path);
}

export async function jsonData<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown, headers?: HeadersInit): Promise<T> {
  return apiData<T>(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function resolveActiveProducts(productIds: string[]): Promise<Map<string, Product>> {
  const wanted = new Set(productIds);
  const found = new Map<string, Product>();
  if (wanted.size === 0) return found;

  let page = 1;
  let totalPages = 1;
  do {
    const response = await apiCollection<Product>(`products?page=${page}&limit=100`);
    for (const product of response.data) {
      if (wanted.has(product.id)) found.set(product.id, product);
    }
    totalPages = response.meta.totalPages;
    page += 1;
  } while (found.size < wanted.size && page <= totalPages);

  return found;
}

export function idempotencyKey(scope: string): string {
  return `${scope}-${crypto.randomUUID()}`;
}

const RECENT_PAYMENT_KEY = 'tradenest:buyer:recent-payment-ids';

function paymentStorageKey(buyerId: string): string | null {
  return /^[0-9a-fA-F-]{36}$/.test(buyerId) ? `${RECENT_PAYMENT_KEY}:${buyerId}` : null;
}

/** These identifiers are only client-side shortcuts; backend checks payment ownership. */
export function rememberPaymentId(paymentId: string, buyerId: string): void {
  if (typeof window === 'undefined') return;
  const key = paymentStorageKey(buyerId);
  if (!key || !/^[0-9a-fA-F-]{36}$/.test(paymentId)) return;
  const existing = recentPaymentIds(buyerId);
  const next = [paymentId, ...existing.filter((id) => id !== paymentId)].slice(0, 12);
  try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { /* disabled storage is non-fatal */ }
}

export function recentPaymentIds(buyerId: string): string[] {
  if (typeof window === 'undefined') return [];
  const key = paymentStorageKey(buyerId);
  if (!key) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value)).slice(0, 12) : [];
  } catch { return []; }
}
