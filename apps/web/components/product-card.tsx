'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, ImageOff, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';
import { jsonData } from '@/lib/api-client';
import { useSession } from './session-provider';
import { Card } from './ui/card';

/** Product information is read from the public catalog; cart mutations remain backend-validated. */
export function ProductCard({ product }: { product: Product }) {
  const { user } = useSession();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const image = product.images.find((candidate) => candidate.isPrimary) || product.images[0];
  const inStock = product.availableQuantity > 0;
  const productUrl = `/products/${encodeURIComponent(product.slug)}`;

  async function addToCart() {
    if (user?.role !== 'BUYER') { setMessage('Sign in as a Buyer to add products to your cart.'); return; }
    if (busy || !inStock) return;
    setBusy(true);
    setMessage(null);
    try {
      await jsonData('cart/items', 'POST', { productId: product.id, quantity: 1 });
      setMessage('Added to cart.');
      void jsonData('events', 'POST', { eventType: 'ADD_TO_CART', productId: product.id }).catch(() => undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not add to cart.'); }
    finally { setBusy(false); }
  }

  async function addToWishlist() {
    if (user?.role !== 'BUYER') { setMessage('Sign in as a Buyer to save products.'); return; }
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await jsonData(`wishlist/${product.id}`, 'POST');
      setMessage('Saved to wishlist.');
      void jsonData('events', 'POST', { eventType: 'WISHLIST', productId: product.id }).catch(() => undefined);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save product.'); }
    finally { setBusy(false); }
  }

  return (
    <Card className="group flex h-full min-w-0 flex-col overflow-hidden transition-shadow duration-200 hover:shadow-[0_14px_36px_rgba(11,42,74,0.11)]">
      <Link href={productUrl} aria-label={`View ${product.name}`} className="relative block aspect-[4/3] overflow-hidden bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tradenest-focus)]">
        {image ? (
          // Seller media URLs may come from multiple hosts; do not enable an unrestricted optimization proxy.
          <Image src={image.url} alt={`${product.name} product photo`} fill sizes="(min-width:1280px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" unoptimized className="object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-50 to-slate-200 text-[var(--tradenest-text-secondary)]"><ImageOff className="size-8" aria-hidden="true" /><span className="text-xs font-medium">Photo coming soon</span></div>
        )}
        {!inStock ? <span className="absolute bottom-3 left-3 rounded-full bg-[var(--tradenest-navy)] px-3 py-1 text-xs font-semibold text-white">Out of stock</span> : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={productUrl} className="line-clamp-2 min-h-10 break-words text-sm font-semibold leading-5 text-[var(--tradenest-navy)] hover:text-[var(--tradenest-blue)] hover:underline sm:text-base sm:leading-6">{product.name}</Link>
            <p className="mt-2 break-words text-lg font-bold tracking-tight text-[var(--tradenest-navy)]">{formatMoney(product.price, product.currency)}</p>
          </div>
          <button type="button" aria-label={`Save ${product.name} to wishlist`} disabled={busy} onClick={() => void addToWishlist()} className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[var(--tradenest-border-strong)] bg-white text-[var(--tradenest-text-secondary)] transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tradenest-focus)] disabled:cursor-not-allowed disabled:opacity-50"><Heart className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="mt-auto flex min-w-0 flex-col gap-3 pt-5">
          <p className={`text-xs font-semibold ${inStock ? 'text-[var(--tradenest-success-ink)]' : 'text-[var(--tradenest-danger-ink)]'}`}>{inStock ? `${product.availableQuantity} available` : 'Currently unavailable'}</p>
          <button type="button" onClick={() => void addToCart()} disabled={busy || !inStock} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--tradenest-radius-control)] bg-[var(--tradenest-navy)] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--tradenest-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tradenest-focus)] disabled:cursor-not-allowed disabled:opacity-50"><ShoppingBag className="size-4" aria-hidden="true" />{busy ? 'Working…' : 'Add to cart'}</button>
        </div>
        {message ? <p role="status" aria-live="polite" className="mt-3 break-words text-xs leading-5 text-[var(--tradenest-text-secondary)]">{message}</p> : null}
      </div>
    </Card>
  );
}
