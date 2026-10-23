'use client';

import { Boxes, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { jsonData } from '@/lib/api-client';
import type { Inventory, Product } from '@/lib/api-types';
import { allSellerProducts } from '@/lib/seller-data';

export default function SellerInventoryPage() { return <SellerShell title="Inventory" description="Set sellable available stock for your own products. Reserved inventory is backend-owned transactional state and is never editable here."><InventoryList /></SellerShell>; }

function InventoryList() {
  const [products, setProducts] = useState<Product[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  async function load() { setLoading(true); setError(null); try { setProducts(await allSellerProducts()); } catch (value) { setError(value instanceof Error ? value.message : 'Could not load inventory.'); } finally { setLoading(false); } }
  useEffect(() => {
    let active = true;

    void allSellerProducts()
      .then((items) => {
        if (active) setProducts(items);
      })
      .catch((value: unknown) => {
        if (active) setError(value instanceof Error ? value.message : 'Could not load inventory.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);
  if (loading) return <LoadingState label="Loading inventory…" />;
  if (error) return <ErrorNotice message={error} />;
  return <div className="grid gap-4">{products.map((product) => <InventoryRow key={product.id} product={product} refresh={() => void load()} />)}{!products.length ? <Card className="p-8 text-center text-sm text-[var(--tradenest-text-secondary)]"><Boxes className="mx-auto size-6" /><p className="mt-3">No seller products yet.</p></Card> : null}</div>;
}

function InventoryRow({ product, refresh }: { product: Product; refresh: () => void }) {
  const [quantity, setQuantity] = useState(String(product.availableQuantity)); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function save() { setBusy(true); setError(null); try { await jsonData<Inventory>(`products/${product.id}/inventory`, 'PATCH', { availableQuantity: Number(quantity) }); refresh(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not update inventory.'); } finally { setBusy(false); } }
  return <Card className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold text-[var(--tradenest-navy)]">{product.name}</h2><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">SKU {product.sku} · {product.status} · current available {product.availableQuantity}</p></div><div className="flex items-end gap-2"><label className="grid gap-1 text-xs font-medium text-[var(--tradenest-text-secondary)]">Available quantity<Input className="w-36" type="number" min="0" max="1000000" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label><Button size="sm" onClick={() => void save()} disabled={busy}><Save className="size-4" />{busy ? 'Saving…' : 'Save'}</Button></div></div>{error ? <div className="mt-3"><ErrorNotice message={error} /></div> : null}</Card>;
}
