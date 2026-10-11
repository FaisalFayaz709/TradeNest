'use client';

import Link from 'next/link';
import { Heart, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';
import { jsonData } from '@/lib/api-client';
import { useSession } from './session-provider';
import { Card } from './ui/card';

export function ProductCard({ product }: { product: Product }) {
  const { user } = useSession();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const image = product.images.find((candidate) => candidate.isPrimary) || product.images[0];

  async function addToCart() {
    if (user?.role !== 'BUYER') { setMessage('Sign in as a Buyer to add products to your cart.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      await jsonData(`cart/items`, 'POST', { productId: product.id, quantity: 1 });
      setMessage('Added to cart.');
      void jsonData('events', 'POST', { eventType: 'ADD_TO_CART', productId: product.id }).catch(() => undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not add to cart.'); }
    finally { setBusy(false); }
  }

  async function addToWishlist() {
    if (user?.role !== 'BUYER') { setMessage('Sign in as a Buyer to save products.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      await jsonData(`wishlist/${product.id}`, 'POST');
      setMessage('Saved to wishlist.');
      void jsonData('events', 'POST', { eventType: 'WISHLIST', productId: product.id }).catch(() => undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save product.'); }
    finally { setBusy(false); }
  }

  return (
    <Card className="group overflow-hidden">
      <Link href={`/products/${encodeURIComponent(product.slug)}`} className="block aspect-[4/3] overflow-hidden bg-slate-100">
        {image ? <img src={image.url} alt={`${product.name} product photo`} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-xs font-semibold uppercase tracking-widest text-slate-400">TradeNest product</div>}
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><Link href={`/products/${encodeURIComponent(product.slug)}`} className="line-clamp-1 font-semibold text-[var(--tradenest-navy)] hover:underline">{product.name}</Link><p className="mt-1 text-sm font-semibold text-[var(--tradenest-text)]">{formatMoney(product.price, product.currency)}</p></div>
          <button type="button" aria-label={`Save ${product.name} to wishlist`} disabled={busy} onClick={() => void addToWishlist()} className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--tradenest-border)] text-[var(--tradenest-text-secondary)] hover:border-pink-200 hover:bg-pink-50 hover:text-pink-700"><Heart className="size-4" /></button>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3"><span className={`text-xs font-medium ${product.availableQuantity > 0 ? 'text-[var(--tradenest-success)]' : 'text-[var(--tradenest-danger)]'}`}>{product.availableQuantity > 0 ? `${product.availableQuantity} available` : 'Out of stock'}</span><button type="button" onClick={() => void addToCart()} disabled={busy || product.availableQuantity < 1} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tradenest-navy)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><ShoppingBag className="size-3.5" />Add</button></div>
        {message ? <p role="status" className="mt-3 text-xs leading-5 text-[var(--tradenest-text-secondary)]">{message}</p> : null}
      </div>
    </Card>
  );
}
