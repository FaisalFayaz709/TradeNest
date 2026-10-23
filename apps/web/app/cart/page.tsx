'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BuyerGate } from '@/components/buyer-gate';
import { EmptyState } from '@/components/empty-state';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiData, jsonData, resolveActiveProducts } from '@/lib/api-client';
import type { Cart, Product } from '@/lib/api-types';
import { formatMoney, multiplyMoney, sumMoney } from '@/lib/money';

export default function CartPage() {
  return <PageShell eyebrow="Buyer" title="Your cart" description="Review your items, update quantities and continue when you are ready. Final prices and availability are confirmed at checkout."><BuyerGate><CartContent /></BuyerGate></PageShell>;
}

function CartContent() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);

  // Initial loading updates React state only after the API returns, and ignores late responses.
  useEffect(() => {
    let active = true;
    void readCart()
      .then(({ nextCart, nextProducts }) => {
        if (!active) return;
        setCart(nextCart);
        setProducts(nextProducts);
      })
      .catch((value: unknown) => {
        if (active) setError(value instanceof Error ? value.message : 'Could not load cart.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refreshCart() {
    const { nextCart, nextProducts } = await readCart();
    setCart(nextCart);
    setProducts(nextProducts);
  }

  const estimate = useMemo(() => {
    if (!cart) return null;
    const available = cart.items.map((item) => { const product = products.get(item.productId); return product ? { currency: product.currency, amount: multiplyMoney(product.price, item.quantity) } : null; }).filter((value): value is { currency: string; amount: string } => Boolean(value));
    const currencies = [...new Set(available.map((value) => value.currency))];
    const currency = currencies[0];
    if (currencies.length !== 1 || !currency) return null;
    return { currency, amount: sumMoney(available.map((value) => value.amount)) };
  }, [cart, products]);

  async function runCartAction(key: string, action: () => Promise<unknown>, failure: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(key);
    setError(null);
    try {
      await action();
      await refreshCart();
    } catch (value) {
      setError(value instanceof Error ? value.message : failure);
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  }

  function update(itemId: string, quantity: number, available: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > available) return;
    void runCartAction(
      itemId,
      () => jsonData(`cart/items/${itemId}`, 'PATCH', { quantity }),
      'Could not update quantity.',
    );
  }

  function remove(itemId: string) {
    void runCartAction(itemId, () => jsonData(`cart/items/${itemId}`, 'DELETE'), 'Could not remove item.');
  }

  function clear() {
    if (!window.confirm('Remove all products from your cart?')) return;
    void runCartAction('clear', () => jsonData('cart', 'DELETE'), 'Could not clear cart.');
  }

  const containsUnavailable = cart?.items.some((item) => {
    const product = products.get(item.productId);
    return !product || product.status !== 'ACTIVE' || product.availableQuantity < item.quantity;
  }) ?? false;
  const itemCount = cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;

  if (loading) return <LoadingState label="Loading your cart…" />;
  if (error && !cart) return (
    <div className="space-y-4">
      <ErrorNotice message={error} />
      <Button variant="outline" asChild><Link href="/explore">Explore products</Link></Button>
    </div>
  );
  if (!cart || cart.items.length === 0) return (
    <EmptyState
      icon={ShoppingBag}
      title="Your cart is empty"
      description="Find something you love in the marketplace. Your saved items will be here when you're ready."
      action={<Button asChild><Link href="/explore">Explore products <ArrowRight aria-hidden="true" className="size-4" /></Link></Button>}
    />
  );

  return (
    <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(290px,360px)] lg:gap-7">
      <section aria-label="Products in your cart" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-[var(--tradenest-navy)]">Your items <span className="text-sm font-normal text-[var(--tradenest-text-secondary)]">({itemCount})</span></h2>
          <Button variant="ghost" size="sm" className="text-[var(--tradenest-danger)]" onClick={clear} disabled={busyId !== null}>
            <Trash2 aria-hidden="true" className="size-4" />{busyId === 'clear' ? 'Clearing…' : 'Clear cart'}
          </Button>
        </div>
        {error ? <ErrorNotice message={error} /> : null}
        {cart.items.map((item) => {
          const product = products.get(item.productId);
          const available = product?.availableQuantity ?? 0;
          const usable = Boolean(product?.status === 'ACTIVE' && available >= item.quantity);
          const image = product?.images.find((candidate) => candidate.isPrimary) ?? product?.images[0];
          const isBusy = busyId === item.id;
          const disabled = busyId !== null || !product || product.status !== 'ACTIVE';
          return (
            <Card key={item.id} className="p-4 sm:p-5">
              <div className="grid min-w-0 grid-cols-[84px_minmax(0,1fr)] gap-3 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-5">
                <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                  {image ? <Image src={image.url} alt={product?.name ?? 'Product'} fill sizes="(max-width: 640px) 84px, 112px" className="object-cover" unoptimized /> : <div className="flex h-full items-center justify-center px-2 text-center text-xs font-medium text-slate-400">No photo</div>}
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      {product ? <Link href={`/products/${encodeURIComponent(product.slug)}`} className="block break-words font-semibold leading-snug text-[var(--tradenest-navy)] hover:text-[var(--tradenest-blue)] hover:underline">{product.name}</Link> : <h3 className="break-words font-semibold text-[var(--tradenest-navy)]">Unavailable product</h3>}
                      <p className="mt-1 text-sm text-[var(--tradenest-text-secondary)]">{product ? formatMoney(product.price, product.currency) : `Product ${item.productId}`}</p>
                    </div>
                    <button type="button" aria-label={`Remove ${product?.name ?? 'unavailable product'} from cart`} disabled={busyId !== null} onClick={() => remove(item.id)} className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--tradenest-danger)] hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tradenest-focus)] disabled:opacity-40">
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  {!usable ? <p className="mt-2 text-xs font-semibold text-[var(--tradenest-danger)]">{product ? 'Quantity exceeds available stock, or the listing is unavailable.' : 'This listing is no longer available.'}</p> : null}
                </div>
                <div className="col-span-2 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--tradenest-border)] pt-3 sm:col-start-2 sm:pt-2 sm:border-0">
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--tradenest-text-secondary)]">Quantity</p>
                    <div role="group" aria-label={`Quantity for ${product?.name ?? 'unavailable product'}`} className="inline-flex items-center overflow-hidden rounded-xl border border-[var(--tradenest-border-strong)]">
                      <button type="button" aria-label="Decrease quantity" disabled={disabled || item.quantity <= 1} onClick={() => update(item.id, Math.min(item.quantity - 1, available), available)} className="flex size-11 items-center justify-center bg-white hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--tradenest-focus)] disabled:opacity-35"><Minus aria-hidden="true" className="size-4" /></button>
                      <span aria-live="polite" className="min-w-10 px-2 text-center text-sm font-semibold tabular-nums text-[var(--tradenest-navy)]">{isBusy ? '…' : item.quantity}</span>
                      <button type="button" aria-label="Increase quantity" disabled={disabled || item.quantity >= available} onClick={() => update(item.id, item.quantity + 1, available)} className="flex size-11 items-center justify-center bg-white hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--tradenest-focus)] disabled:opacity-35"><Plus aria-hidden="true" className="size-4" /></button>
                    </div>
                  </div>
                  {product ? <div className="min-w-0 text-right"><p className="break-words text-base font-semibold text-[var(--tradenest-navy)]">{formatMoney(multiplyMoney(product.price, item.quantity), product.currency)}</p><p className="text-xs text-[var(--tradenest-text-secondary)]">Catalog estimate</p></div> : null}
                </div>
              </div>
            </Card>
          );
        })}
        <Button variant="outline" asChild><Link href="/explore">Continue shopping</Link></Button>
      </section>

      <aside aria-label="Cart summary" className="min-w-0 lg:sticky lg:top-24">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Order summary</h2>
          <div className="mt-5 flex items-center justify-between gap-3 border-b border-[var(--tradenest-border)] pb-4 text-sm"><span className="text-[var(--tradenest-text-secondary)]">Items</span><span className="font-medium tabular-nums">{itemCount}</span></div>
          <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3"><span className="text-sm text-[var(--tradenest-text-secondary)]">Catalog estimate</span><strong className="break-words text-xl text-[var(--tradenest-navy)]">{estimate && !containsUnavailable ? formatMoney(estimate.amount, estimate.currency) : 'Calculated at checkout'}</strong></div>
          <p className="mt-3 text-xs leading-5 text-[var(--tradenest-text-secondary)]">This is not your final total. The checkout service recalculates current prices, stock, discounts and shipping.</p>
          {containsUnavailable ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">Remove unavailable items or reduce quantities before continuing.</p> : null}
          {containsUnavailable || busyId !== null
            ? <Button size="lg" className="mt-5 w-full" disabled>{busyId ? 'Updating cart…' : 'Review cart availability'}</Button>
            : <Button size="lg" className="mt-5 w-full" asChild><Link href="/checkout">Continue to checkout</Link></Button>}
          <p className="mt-3 text-center text-xs text-[var(--tradenest-text-secondary)]">No payment is collected on this page.</p>
        </Card>
      </aside>
    </div>
  );
}

async function readCart(): Promise<{ nextCart: Cart; nextProducts: Map<string, Product> }> {
  const nextCart = await apiData<Cart>('cart');
  const nextProducts = await resolveActiveProducts(nextCart.items.map((item) => item.productId));
  return { nextCart, nextProducts };
}
