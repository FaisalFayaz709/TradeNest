'use client';

import Link from 'next/link';
import { Heart, ShieldCheck, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { ProductCard } from '@/components/product-card';
import { useSession } from '@/components/session-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiCollection, apiData, jsonData, resolveActiveProducts } from '@/lib/api-client';
import type { Product, Review } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

type RecommendationSet = { items: Array<{ productId: string; score: number }>; modelVersion: string; generatedAt: string };

export function ProductDetailClient() {
  const params = useParams<{ slug: string }>();
  const { user } = useSession();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    const slug = decodeURIComponent(params.slug || '');
    if (!slug) return;
    setLoading(true); setError(null);
    void apiData<Product>(`products/${encodeURIComponent(slug)}`).then(async (value) => {
      setProduct(value);
      void apiCollection<Review>(`products/${value.id}/reviews?page=1&limit=20`).then((result) => setReviews(result.data)).catch(() => setReviews([]));
      void apiData<RecommendationSet>(`ai/recommendations/products/${value.id}?limit=4`).then(async (set) => {
        const map = await resolveActiveProducts(set.items.map((item) => item.productId));
        setSimilar(set.items.map((item) => map.get(item.productId)).filter((item): item is Product => Boolean(item)));
      }).catch(() => setSimilar([]));
      void jsonData('events', 'POST', { eventType: 'PRODUCT_VIEW', productId: value.id }).catch(() => undefined);
    }).catch((value) => setError(value instanceof Error ? value.message : 'Could not load product.')).finally(() => setLoading(false));
  }, [params.slug]);

  const averageRating = useMemo(() => reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null, [reviews]);

  async function addToCart() {
    if (!product) return;
    if (user?.role !== 'BUYER') { setActionMessage('Sign in as a Buyer to add this product to your cart.'); return; }
    try { await jsonData('cart/items', 'POST', { productId: product.id, quantity }); setActionMessage('Added to cart.'); void jsonData('events', 'POST', { eventType: 'ADD_TO_CART', productId: product.id }).catch(() => undefined); }
    catch (value) { setActionMessage(value instanceof Error ? value.message : 'Could not add to cart.'); }
  }

  async function save() {
    if (!product) return;
    if (user?.role !== 'BUYER') { setActionMessage('Sign in as a Buyer to save this product.'); return; }
    try { await jsonData(`wishlist/${product.id}`, 'POST'); setActionMessage('Saved to wishlist.'); void jsonData('events', 'POST', { eventType: 'WISHLIST', productId: product.id }).catch(() => undefined); }
    catch (value) { setActionMessage(value instanceof Error ? value.message : 'Could not save product.'); }
  }

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><LoadingState label="Loading product…" /></main>;
  if (error || !product) return <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><ErrorNotice message={error || 'Product not found.'} /></main>;
  const primary = product.images.find((image) => image.isPrimary) || product.images[0];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mb-6 text-sm text-[var(--tradenest-text-secondary)]"><Link href="/explore" className="hover:text-[var(--tradenest-navy)]">Explore</Link><span className="mx-2">/</span>{product.name}</div>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Card className="overflow-hidden"><div className="aspect-square bg-slate-100">{primary ? <img src={primary.url} alt={product.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">TradeNest product</div>}</div></Card>
          {product.images.length > 1 ? <div className="mt-3 grid grid-cols-5 gap-3">{product.images.slice(0, 5).map((image) => <div key={image.id} className="aspect-square overflow-hidden rounded-xl border border-[var(--tradenest-border)] bg-slate-100"><img src={image.url} alt="" className="h-full w-full object-cover" /></div>)}</div> : null}
        </div>
        <div className="lg:py-4">
          <div className="flex flex-wrap gap-2"><Badge tone="success">Active listing</Badge><Badge tone="escrow">Protected checkout</Badge></div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--tradenest-navy)] sm:text-4xl">{product.name}</h1>
          <div className="mt-3 flex items-center gap-3"><p className="text-2xl font-semibold text-[var(--tradenest-text)]">{formatMoney(product.price, product.currency)}</p>{averageRating !== null ? <span className="inline-flex items-center gap-1 text-sm font-medium text-amber-700"><Star className="size-4 fill-current" />{averageRating.toFixed(1)} ({reviews.length})</span> : <span className="text-sm text-[var(--tradenest-text-secondary)]">No reviews yet</span>}</div>
          <p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-[var(--tradenest-text-secondary)]">{product.description}</p>
          <div className="mt-6 rounded-xl border border-[var(--tradenest-border)] bg-slate-50 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[var(--tradenest-navy)]"><ShieldCheck className="size-4 text-[var(--tradenest-gold)]" />Backend-authoritative checkout</div><p className="mt-1 text-xs leading-5 text-[var(--tradenest-text-secondary)]">The price and stock shown here are catalog values. Checkout reloads the current seller, product, price, and inventory before creating an order.</p></div>
          <div className="mt-6 flex flex-wrap items-end gap-3"><label className="grid gap-1.5 text-xs font-semibold text-[var(--tradenest-text-secondary)]">Quantity<input type="number" min={1} max={Math.max(1, product.availableQuantity)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(product.availableQuantity || 1, Number(event.target.value) || 1)))} className="h-11 w-24 rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border)] bg-white px-3 text-sm" /></label><Button size="lg" disabled={product.availableQuantity < 1} onClick={() => void addToCart()}><ShoppingBag className="size-4" />Add to cart</Button><Button size="lg" variant="outline" onClick={() => void save()}><Heart className="size-4" />Save</Button></div>
          <p className={`mt-3 text-sm font-medium ${product.availableQuantity > 0 ? 'text-[var(--tradenest-success)]' : 'text-[var(--tradenest-danger)]'}`}>{product.availableQuantity > 0 ? `${product.availableQuantity} currently available` : 'Currently out of stock'}</p>
          {actionMessage ? <p className="mt-3 text-sm text-[var(--tradenest-text-secondary)]">{actionMessage}</p> : null}
          <div className="mt-8 border-t border-[var(--tradenest-border)] pt-6"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--tradenest-text-secondary)]">SKU</p><p className="mt-1 font-mono text-sm text-[var(--tradenest-text)]">{product.sku}</p></div>
        </div>
      </div>

      <section className="mt-14"><div className="mb-5 flex items-center gap-2"><Star className="size-5 text-[var(--tradenest-gold)]" /><h2 className="text-2xl font-semibold text-[var(--tradenest-navy)]">Buyer reviews</h2></div>{reviews.length ? <div className="grid gap-4 md:grid-cols-2">{reviews.map((review) => <Card key={review.id} className="p-5"><div className="flex gap-1 text-amber-500">{Array.from({ length: review.rating }, (_, index) => <Star key={index} className="size-4 fill-current" />)}</div><p className="mt-3 text-sm leading-6 text-[var(--tradenest-text-secondary)]">{review.comment || 'Rating submitted without a written comment.'}</p><p className="mt-3 text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</p></Card>)}</div> : <p className="text-sm text-[var(--tradenest-text-secondary)]">No verified-purchase reviews yet.</p>}</section>

      {similar.length ? <section className="mt-14"><div className="mb-5 flex items-center gap-2"><Sparkles className="size-5 text-[var(--tradenest-teal)]" /><h2 className="text-2xl font-semibold text-[var(--tradenest-navy)]">Similar products</h2><Badge tone="ai">AI-assisted</Badge></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{similar.map((candidate) => <ProductCard key={candidate.id} product={candidate} />)}</div></section> : null}
    </main>
  );
}
