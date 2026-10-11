'use client';

import Link from 'next/link';
import { Heart, ShoppingBag, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { BuyerGate } from '@/components/buyer-gate';
import { EmptyState } from '@/components/empty-state';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiData, jsonData, resolveActiveProducts } from '@/lib/api-client';
import type { Product, WishlistItem } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export default function WishlistPage() { return <PageShell eyebrow="Buyer" title="Wishlist" description="Your saved products stay separate from checkout. Current availability and price are still revalidated by the backend before an order can be created."><BuyerGate><WishlistContent /></BuyerGate></PageShell>; }

function WishlistContent() {
  const [items, setItems] = useState<WishlistItem[]>([]); const [products, setProducts] = useState<Map<string, Product>>(new Map()); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { const list = await apiData<WishlistItem[]>('wishlist'); setItems(list); setProducts(await resolveActiveProducts(list.map((item) => item.productId))); } catch (value) { setError(value instanceof Error ? value.message : 'Could not load wishlist.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function remove(productId: string) { setBusy(productId); try { await jsonData(`wishlist/${productId}`, 'DELETE'); await load(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not remove saved product.'); } finally { setBusy(null); } }
  async function add(productId: string) { setBusy(productId); try { await jsonData('cart/items', 'POST', { productId, quantity: 1 }); } catch (value) { setError(value instanceof Error ? value.message : 'Could not add to cart.'); } finally { setBusy(null); } }
  if (loading) return <LoadingState label="Loading wishlist…" />; if (error && !items.length) return <ErrorNotice message={error} />; if (!items.length) return <EmptyState icon={Heart} title="Your wishlist is empty" description="Save products while browsing and they will appear here." action={<Link href="/explore"><Button>Explore products</Button></Link>} />;
  return <div>{error ? <div className="mb-4"><ErrorNotice message={error} /></div> : null}<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => { const product = products.get(item.productId); return <Card key={item.id} className="overflow-hidden"><div className="aspect-[4/3] bg-slate-100">{product?.images[0] ? <img src={product.images[0].url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-semibold uppercase tracking-widest text-slate-400">Unavailable product</div>}</div><div className="p-4"><h2 className="font-semibold text-[var(--tradenest-navy)]">{product?.name || 'No longer active'}</h2><p className="mt-1 text-sm text-[var(--tradenest-text-secondary)]">{product ? formatMoney(product.price, product.currency) : item.productId}</p><div className="mt-4 flex gap-2"><Button size="sm" disabled={!product || product.availableQuantity < 1 || busy === item.productId} onClick={() => void add(item.productId)}><ShoppingBag className="size-4" />Add to cart</Button><Button size="sm" variant="outline" disabled={busy === item.productId} onClick={() => void remove(item.productId)}><Trash2 className="size-4" />Remove</Button></div>{product ? <Link href={`/products/${product.slug}`} className="mt-3 inline-block text-xs font-semibold text-[var(--tradenest-blue)] hover:underline">View product →</Link> : null}</div></Card>; })}</div></div>;
}
