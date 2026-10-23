'use client';

import Link from 'next/link';
import { Heart, Minus, Plus, ShieldCheck, ShoppingBag, Sparkles, Star } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { ProductCard } from '@/components/product-card';
import { ProductGallery } from '@/components/product-gallery';
import { useSession } from '@/components/session-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiCollection, apiData, jsonData, resolveActiveProducts } from '@/lib/api-client';
import type { Product, Review } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

type RecommendationSet = { items: Array<{ productId: string; score: number }>; modelVersion: string; generatedAt: string };
type PurchaseAction = 'cart' | 'wishlist';

export function ProductDetailClient() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || '';
  if (!slug) {
    return <main className="mx-auto max-w-7xl px-4 py-12"><ErrorNotice message="Product not found." /></main>;
  }
  // A route change remounts the content, so gallery, quantity and requests cannot leak between products.
  return <ProductDetailContent key={slug} slug={slug} />;
}

function ProductDetailContent({ slug }: { slug: string }) {
  const { user } = useSession();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reviewsFailed, setReviewsFailed] = useState(false);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<PurchaseAction | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const value = await apiData<Product>(`products/${encodeURIComponent(slug)}`);
        if (!active) return;
        setProduct(value);
        setLoading(false);

        void apiCollection<Review>(`products/${value.id}/reviews?page=1&limit=20`)
          .then((result) => { if (active) setReviews(result.data); })
          .catch(() => { if (active) setReviewsFailed(true); })
          .finally(() => { if (active) setReviewsLoaded(true); });

        void apiData<RecommendationSet>(`ai/recommendations/products/${value.id}?limit=4`)
          .then(async (recommendations) => {
            const found = await resolveActiveProducts(recommendations.items.map((item) => item.productId));
            if (active) setSimilar(recommendations.items.map((item) => found.get(item.productId)).filter((item): item is Product => Boolean(item)));
          })
          .catch(() => { if (active) setSimilar([]); });

        void jsonData('events', 'POST', { eventType: 'PRODUCT_VIEW', productId: value.id }).catch(() => undefined);
      } catch (value) {
        if (active) {
          setError(value instanceof Error ? value.message : 'Could not load product.');
          setLoading(false);
        }
      }
    })();
    return () => { active = false; };
  }, [slug]);

  const averageRating = useMemo(
    () => reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null,
    [reviews],
  );

  async function addToCart() {
    if (!product || busy || product.status !== 'ACTIVE' || product.availableQuantity < 1) return;
    if (user?.role !== 'BUYER') { setActionMessage('Sign in as a Buyer to add this product to your cart.'); return; }
    setBusy('cart');
    setActionMessage(null);
    try {
      await jsonData('cart/items', 'POST', { productId: product.id, quantity });
      setActionMessage('Added to cart.');
      void jsonData('events', 'POST', { eventType: 'ADD_TO_CART', productId: product.id }).catch(() => undefined);
    } catch (value) {
      setActionMessage(value instanceof Error ? value.message : 'Could not add to cart.');
    } finally { setBusy(null); }
  }

  async function save() {
    if (!product || busy) return;
    if (user?.role !== 'BUYER') { setActionMessage('Sign in as a Buyer to save this product.'); return; }
    setBusy('wishlist');
    setActionMessage(null);
    try {
      await jsonData(`wishlist/${product.id}`, 'POST');
      setActionMessage('Saved to wishlist.');
      void jsonData('events', 'POST', { eventType: 'WISHLIST', productId: product.id }).catch(() => undefined);
    } catch (value) {
      setActionMessage(value instanceof Error ? value.message : 'Could not save product.');
    } finally { setBusy(null); }
  }

  if (loading) return <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><LoadingState label="Loading product…" /></main>;
  if (error || !product) return <main className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 lg:px-8"><ErrorNotice message={error || 'Product not found.'} /><Button asChild variant="outline"><Link href="/explore">Back to marketplace</Link></Button></main>;

  const available = Math.max(0, Math.floor(product.availableQuantity));
  const canPurchase = product.status === 'ACTIVE' && available > 0;
  const setBoundedQuantity = (value: number) => setQuantity(Math.max(1, Math.min(available || 1, Math.trunc(value) || 1)));

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 flex min-w-0 items-center gap-2 text-sm text-[var(--tradenest-text-secondary)]">
        <Link href="/explore" className="shrink-0 font-medium hover:text-[var(--tradenest-navy)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--tradenest-focus)]">Marketplace</Link>
        <span aria-hidden="true">/</span>
        <span className="min-w-0 truncate text-[var(--tradenest-navy)]" aria-current="page">{product.name}</span>
      </nav>

      <div className="grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-start lg:gap-10">
        <ProductGallery productName={product.name} images={product.images} />

        <div className="min-w-0 lg:pt-2">
          <div className="flex flex-wrap gap-2">
            <Badge tone={product.status === 'ACTIVE' ? 'success' : 'warning'}>{product.status === 'ACTIVE' ? 'Active listing' : 'Listing unavailable'}</Badge>
            <Badge tone="escrow">Secure checkout</Badge>
          </div>
          <h1 className="mt-4 break-words text-3xl font-semibold leading-tight tracking-tight text-[var(--tradenest-navy)] sm:text-4xl">{product.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="break-words text-3xl font-bold tracking-tight text-[var(--tradenest-navy)]">{formatMoney(product.price, product.currency)}</p>
            {averageRating !== null ? (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700"><Star className="size-4 fill-current" aria-hidden="true" />{averageRating.toFixed(1)} <span className="font-normal text-[var(--tradenest-text-secondary)]">({reviews.length} reviews)</span></span>
            ) : reviewsLoaded && !reviewsFailed ? <span className="text-sm text-[var(--tradenest-text-secondary)]">No ratings yet</span> : null}
          </div>
          <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-[var(--tradenest-text-secondary)] sm:text-base">{product.description}</p>

          <Card className="mt-7 p-4 sm:p-5">
            <p className={`text-sm font-semibold ${canPurchase ? 'text-[var(--tradenest-success-ink)]' : 'text-[var(--tradenest-danger-ink)]'}`}>
              {canPurchase ? `${available} available` : 'Currently unavailable'}
            </p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="shrink-0">
                <label htmlFor="product-quantity" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--tradenest-text-secondary)]">Quantity</label>
                <div className="flex h-12 w-full items-stretch overflow-hidden rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border-strong)] sm:w-40">
                  <button type="button" aria-label="Decrease quantity" disabled={!canPurchase || busy !== null || quantity <= 1} onClick={() => setBoundedQuantity(quantity - 1)} className="flex min-w-11 flex-1 items-center justify-center hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--tradenest-focus)] disabled:cursor-not-allowed disabled:opacity-40"><Minus className="size-4" aria-hidden="true" /></button>
                  <input id="product-quantity" type="number" inputMode="numeric" min={1} max={Math.max(1, available)} step={1} value={quantity} onChange={(event) => setBoundedQuantity(Number(event.target.value))} disabled={!canPurchase || busy !== null} className="w-12 min-w-0 border-x border-[var(--tradenest-border)] bg-white text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus-visible:outline-2 focus-visible:outline-[var(--tradenest-focus)]" />
                  <button type="button" aria-label="Increase quantity" disabled={!canPurchase || busy !== null || quantity >= available} onClick={() => setBoundedQuantity(quantity + 1)} className="flex min-w-11 flex-1 items-center justify-center hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[var(--tradenest-focus)] disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-4" aria-hidden="true" /></button>
                </div>
              </div>
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Button size="lg" className="w-full" disabled={!canPurchase || busy !== null} onClick={() => void addToCart()}><ShoppingBag className="size-4" aria-hidden="true" />{busy === 'cart' ? 'Adding…' : 'Add to cart'}</Button>
                <Button size="lg" variant="outline" className="w-full" disabled={busy !== null} onClick={() => void save()}><Heart className="size-4" aria-hidden="true" />{busy === 'wishlist' ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
            {actionMessage ? <p role="status" aria-live="polite" className="mt-4 break-words rounded-lg bg-slate-50 px-3 py-2 text-sm text-[var(--tradenest-text-secondary)]">{actionMessage}</p> : null}
            <p className="mt-4 flex items-start gap-2 border-t border-[var(--tradenest-border)] pt-4 text-xs leading-5 text-[var(--tradenest-text-secondary)]"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--tradenest-teal-ink)]" aria-hidden="true" />Price and availability are checked again during checkout before an order is placed.</p>
          </Card>
          <div className="mt-6 text-xs text-[var(--tradenest-text-secondary)]"><span className="font-semibold uppercase tracking-[0.12em]">SKU</span><p className="mt-1 break-all font-mono text-sm text-[var(--tradenest-text)]">{product.sku}</p></div>
        </div>
      </div>

      <section aria-labelledby="product-reviews-heading" className="mt-12 sm:mt-16">
        <div className="mb-5 flex items-center gap-2"><Star className="size-5 text-[var(--tradenest-gold)]" aria-hidden="true" /><h2 id="product-reviews-heading" className="text-2xl font-semibold text-[var(--tradenest-navy)]">Buyer reviews</h2></div>
        {!reviewsLoaded ? <p role="status" className="text-sm text-[var(--tradenest-text-secondary)]">Loading reviews…</p> : reviewsFailed ? <p className="text-sm text-[var(--tradenest-text-secondary)]">Reviews are unavailable right now.</p> : reviews.length ? (
          <div className="grid gap-4 md:grid-cols-2">{reviews.map((review) => <Card key={review.id} className="min-w-0 p-5"><div className="flex gap-1 text-amber-500" aria-label={`${review.rating} out of 5 stars`}>{Array.from({ length: review.rating }, (_, index) => <Star key={index} className="size-4 fill-current" aria-hidden="true" />)}</div><p className="mt-3 break-words text-sm leading-6 text-[var(--tradenest-text-secondary)]">{review.comment || 'Rating submitted without a written comment.'}</p><p className="mt-3 text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</p></Card>)}</div>
        ) : <p className="text-sm text-[var(--tradenest-text-secondary)]">No reviews yet.</p>}
      </section>

      {similar.length ? <section aria-labelledby="similar-products-heading" className="mt-12 sm:mt-16"><div className="mb-5 flex flex-wrap items-center gap-2"><Sparkles className="size-5 text-[var(--tradenest-teal)]" aria-hidden="true" /><h2 id="similar-products-heading" className="text-2xl font-semibold text-[var(--tradenest-navy)]">You may also like</h2><Badge tone="ai">AI-assisted</Badge></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{similar.map((candidate) => <ProductCard key={candidate.id} product={candidate} />)}</div></section> : null}
    </main>
  );
}
