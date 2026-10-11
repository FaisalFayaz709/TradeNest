'use client';

import Link from 'next/link';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  return <PageShell eyebrow="Buyer" title="Your cart" description="Cart values are convenient shopping state. TradeNest reloads authoritative product, seller, price, and inventory data when you request a checkout quote."><BuyerGate><CartContent /></BuyerGate></PageShell>;
}

function CartContent() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const value = await apiData<Cart>('cart'); setCart(value); setProducts(await resolveActiveProducts(value.items.map((item) => item.productId))); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not load cart.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const estimate = useMemo(() => {
    if (!cart) return null;
    const available = cart.items.map((item) => { const product = products.get(item.productId); return product ? { currency: product.currency, amount: multiplyMoney(product.price, item.quantity) } : null; }).filter((value): value is { currency: string; amount: string } => Boolean(value));
    const currencies = [...new Set(available.map((value) => value.currency))];
    if (currencies.length !== 1) return null;
    return { currency: currencies[0], amount: sumMoney(available.map((value) => value.amount)) };
  }, [cart, products]);

  async function update(itemId: string, quantity: number) {
    if (quantity < 1) return;
    setBusyId(itemId);
    try { await jsonData(`cart/items/${itemId}`, 'PATCH', { quantity }); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not update cart.'); }
    finally { setBusyId(null); }
  }

  async function remove(itemId: string) {
    setBusyId(itemId);
    try { await jsonData(`cart/items/${itemId}`, 'DELETE'); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not remove item.'); }
    finally { setBusyId(null); }
  }

  async function clear() {
    setBusyId('clear');
    try { await jsonData('cart', 'DELETE'); await load(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Could not clear cart.'); }
    finally { setBusyId(null); }
  }

  if (loading) return <LoadingState label="Loading your cart…" />;
  if (error && !cart) return <ErrorNotice message={error} />;
  if (!cart || cart.items.length === 0) return <EmptyState icon={ShoppingBag} title="Your cart is empty" description="Browse active TradeNest listings and add products when you are ready." action={<Link href="/explore"><Button>Explore products</Button></Link>} />;

  return <div className="grid gap-6 lg:grid-cols-[1fr_360px]"> <div className="grid gap-4">{error ? <ErrorNotice message={error} /> : null}{cart.items.map((item) => { const product = products.get(item.productId); return <Card key={item.id} className="p-4 sm:p-5"><div className="flex gap-4"><div className="size-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">{product?.images[0] ? <img src={product.images[0].url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center px-2 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">Unavailable image</div>}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-[var(--tradenest-navy)]">{product?.name || 'Unavailable product'}</h2><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">{product ? formatMoney(product.price, product.currency) : `Product ${item.productId}`}</p></div><button type="button" aria-label="Remove item" disabled={busyId === item.id} onClick={() => void remove(item.id)} className="flex size-9 items-center justify-center rounded-lg text-[var(--tradenest-danger)] hover:bg-red-50 disabled:opacity-40"><Trash2 className="size-4" /></button></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs font-medium text-[var(--tradenest-text-secondary)]">Quantity<input type="number" min={1} max={product?.availableQuantity || 1000000} value={item.quantity} disabled={busyId === item.id} onChange={(event) => void update(item.id, Number(event.target.value) || 1)} className="h-9 w-20 rounded-lg border border-[var(--tradenest-border)] px-2" /></label>{product ? <p className="text-sm font-semibold">{formatMoney(multiplyMoney(product.price, item.quantity), product.currency)} <span className="font-normal text-[var(--tradenest-text-secondary)]">estimate</span></p> : <p className="text-xs font-medium text-[var(--tradenest-danger)]">No longer active in the public catalog</p>}</div></div></div></Card>; })}<Button variant="ghost" className="justify-self-start text-[var(--tradenest-danger)]" onClick={() => void clear()} disabled={busyId === 'clear'}>Clear cart</Button></div><Card className="h-fit p-5 lg:sticky lg:top-24"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--tradenest-text-secondary)]">Catalog estimate</p><p className="mt-2 text-2xl font-semibold text-[var(--tradenest-navy)]">{estimate ? formatMoney(estimate.amount, estimate.currency) : 'Calculated at checkout'}</p><p className="mt-3 text-xs leading-5 text-[var(--tradenest-text-secondary)]">This is not the authoritative checkout total. Shipping, discounts, current prices, seller state, and stock are recalculated by NestJS.</p><Link href="/checkout" className="mt-5 block"><Button size="lg" className="w-full">Continue to checkout</Button></Link></Card></div>;
}
