'use client';

import { Archive, BrainCircuit, ImagePlus, PackagePlus, Send, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { SellerShell } from '@/components/seller/seller-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiData, jsonData } from '@/lib/api-client';
import { uploadManagedFile } from '@/lib/managed-upload';
import type { Category, Product, SmartPricingSuggestion } from '@/lib/api-types';
import { allSellerProducts } from '@/lib/seller-data';
import { formatMoney } from '@/lib/money';

export default function SellerProductsPage() { return <SellerShell title="Products" description="Create and manage your catalog. Product lifecycle changes use command endpoints; status is never patched directly."><Products /></SellerShell>; }

function Products() {
  const [products, setProducts] = useState<Product[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  async function load() { setLoading(true); setError(null); try { const [items, cats] = await Promise.all([allSellerProducts(), apiData<Category[]>('categories')]); setProducts(items); setCategories(cats); } catch (value) { setError(value instanceof Error ? value.message : 'Could not load seller products.'); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, []);
  if (loading) return <LoadingState label="Loading seller products…" />;
  return <div className="grid gap-6">{error ? <ErrorNotice message={error} /> : null}<CreateProduct categories={categories} onCreated={() => void load()} /><div className="grid gap-4">{products.length ? products.map((product) => <ProductRow key={product.id} product={product} categories={categories} refresh={() => void load()} />) : <Card className="p-8 text-center text-sm text-[var(--tradenest-text-secondary)]">No products yet. Create your first DRAFT above.</Card>}</div></div>;
}

function CreateProduct({ categories, onCreated }: { categories: Category[]; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', description: '', categoryId: categories[0]?.id || '', price: '', stock: '0', sku: '' }); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!form.categoryId && categories[0]) setForm((value) => ({ ...value, categoryId: categories[0]!.id })); }, [categories, form.categoryId]);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { await jsonData<Product>('products', 'POST', { name: form.name, description: form.description, categoryId: form.categoryId, price: Number(form.price), stock: Number(form.stock), sku: form.sku }); setForm({ name: '', description: '', categoryId: categories[0]?.id || '', price: '', stock: '0', sku: '' }); onCreated(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not create product.'); } finally { setBusy(false); } }
  return <Card className="p-6"><div className="flex items-center gap-2"><PackagePlus className="size-5 text-[var(--tradenest-teal)]" /><h2 className="text-lg font-semibold text-[var(--tradenest-navy)]">Create product draft</h2></div><form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Name<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} minLength={3} maxLength={200} required /></label><label className="grid gap-1.5 text-sm font-medium">SKU<Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} maxLength={100} required /></label><label className="grid gap-1.5 text-sm font-medium">Category<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="h-10 rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border)] bg-white px-3 text-sm" required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="grid gap-1.5 text-sm font-medium">Price<Input type="number" step="0.01" min="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /></label><label className="grid gap-1.5 text-sm font-medium">Opening stock<Input type="number" min="0" max="1000000" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} required /></label></div><label className="grid gap-1.5 text-sm font-medium md:col-span-2">Description<Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} minLength={20} maxLength={5000} required /></label>{error ? <div className="md:col-span-2"><ErrorNotice message={error} /></div> : null}<div className="md:col-span-2"><Button type="submit" disabled={busy || !categories.length}>{busy ? 'Creating…' : 'Create DRAFT'}</Button></div></form></Card>;
}

function ProductRow({ product, categories, refresh }: { product: Product; categories: Category[]; refresh: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [suggestion, setSuggestion] = useState<SmartPricingSuggestion | null>(null); const [imageFile, setImageFile] = useState<File | null>(null);
  async function command(path: string, method: 'POST' | 'DELETE' = 'POST', body?: unknown) { setBusy(true); setError(null); try { await jsonData<unknown>(path, method, body); refresh(); } catch (value) { setError(value instanceof Error ? value.message : 'Product action failed.'); } finally { setBusy(false); } }
  async function pricing() { setBusy(true); setError(null); try { setSuggestion(await apiData<SmartPricingSuggestion>(`ai/pricing/products/${product.id}`)); } catch (value) { setError(value instanceof Error ? value.message : 'Could not get pricing suggestion.'); } finally { setBusy(false); } }
  async function image(event: FormEvent) {
    event.preventDefault();
    if (!imageFile) return;
    setBusy(true); setError(null);
    try {
      const objectKey = await uploadManagedFile('products', product.id, imageFile);
      await jsonData(`products/${product.id}/images`, 'POST', { objectKey, sortOrder: product.images.length, isPrimary: product.images.length === 0 });
      setImageFile(null); refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not upload product image.');
    } finally { setBusy(false); }
  }
  const category = categories.find((item) => item.id === product.categoryId)?.name || product.categoryId;
  return <Card className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--tradenest-navy)]">{product.name}</h3><Badge tone={product.status === 'ACTIVE' ? 'success' : product.status === 'SUSPENDED' ? 'danger' : 'neutral'}>{product.status}</Badge></div><p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">SKU {product.sku} · {category} · {product.availableQuantity} available · {formatMoney(product.price, product.currency)}</p><p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-[var(--tradenest-text-secondary)]">{product.description}</p></div><div className="flex flex-wrap gap-2">{product.status === 'DRAFT' ? <Button size="sm" onClick={() => void command(`products/${product.id}/publish`)} disabled={busy}><Send className="size-4" />Publish</Button> : null}{product.status === 'ACTIVE' ? <Button size="sm" variant="outline" onClick={() => void command(`products/${product.id}/archive`)} disabled={busy}><Archive className="size-4" />Archive</Button> : null}<Button size="sm" variant="ai" onClick={() => void pricing()} disabled={busy || product.status !== 'ACTIVE'}><BrainCircuit className="size-4" />Price insight</Button><Button size="sm" variant="danger" onClick={() => confirm('Delete this product? Referenced products may be blocked by backend integrity rules.') && void command(`products/${product.id}`, 'DELETE')} disabled={busy}><Trash2 className="size-4" /></Button></div></div>{suggestion ? <div className="mt-4 rounded-xl bg-[var(--tradenest-teal-light)] p-4 text-sm"><p className="font-semibold text-[var(--tradenest-navy)]">AI advisory only: {formatMoney(suggestion.suggestedRange.minPrice, suggestion.currency)} – {formatMoney(suggestion.suggestedRange.maxPrice, suggestion.currency)}</p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">Current {formatMoney(suggestion.currentPrice, suggestion.currency)} · {suggestion.signals.productViews} views · {suggestion.signals.completedUnitsSold} units sold · model {suggestion.modelVersion}. TradeNest never changes the price automatically.</p></div> : null}{error ? <div className="mt-4"><ErrorNotice message={error} /></div> : null}<EditProduct product={product} categories={categories} busy={busy} setBusy={setBusy} setError={setError} refresh={refresh} /><form onSubmit={image} className="mt-4 grid gap-2 border-t border-[var(--tradenest-border)] pt-4 sm:grid-cols-[1fr_auto]">
    <label className="grid gap-1 text-sm font-medium">Product image (JPEG, PNG or WebP, up to 5 MB)
      <Input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setImageFile(event.target.files?.[0] || null)} required />
    </label>
    <Button type="submit" variant="outline" disabled={busy || !imageFile}><ImagePlus className="size-4" />{busy ? 'Uploading…' : 'Upload image'}</Button>
  </form><p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">Files upload to private S3-compatible storage through a short-lived authorized upload URL. The API verifies the object before registration.</p></Card>;
}

function EditProduct({ product, categories, busy, setBusy, setError, refresh }: { product: Product; categories: Category[]; busy: boolean; setBusy: (value: boolean) => void; setError: (value: string | null) => void; refresh: () => void }) {
  const [name, setName] = useState(product.name); const [description, setDescription] = useState(product.description); const [categoryId, setCategoryId] = useState(product.categoryId); const [price, setPrice] = useState(product.price); const [sku, setSku] = useState(product.sku);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(null); try { await jsonData<Product>(`products/${product.id}`, 'PATCH', { name, description, categoryId, price: Number(price), sku }); refresh(); } catch (value) { setError(value instanceof Error ? value.message : 'Could not update product.'); } finally { setBusy(false); } }
  return <details className="mt-4 border-t border-[var(--tradenest-border)] pt-4"><summary className="cursor-pointer text-sm font-semibold text-[var(--tradenest-blue)]">Edit product fields</summary><form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2"><Input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={200} required /><Input value={sku} onChange={(event) => setSku(event.target.value)} maxLength={100} required /><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="h-10 rounded-[var(--tradenest-radius-control)] border border-[var(--tradenest-border)] bg-white px-3 text-sm">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Input type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /><Textarea className="md:col-span-2" value={description} onChange={(event) => setDescription(event.target.value)} minLength={20} maxLength={5000} required /><div className="md:col-span-2"><Button type="submit" variant="outline" size="sm" disabled={busy}>Save product fields</Button></div></form></details>;
}
