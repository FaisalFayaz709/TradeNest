'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiCollection, jsonData } from '@/lib/api-client';
import { moderateResource } from '@/lib/admin-moderation';
import type { Product } from '@/lib/api-types';
import { formatMoney } from '@/lib/money';

export default function AdminProductsPage() {
  const [rows, setRows] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setRows((await apiCollection<Product>('admin/products?page=1&limit=100')).data); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not load products.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function moderate(product: Product, action: 'suspend' | 'reactivate') {
    setError(null); setBusy(product.id);
    try {
      const changed = await moderateResource<Product>('products', product.id, action);
      if (changed) await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Product moderation failed.'); }
    finally { setBusy(null); }
  }
  async function remove(id: string) {
    if (!window.confirm('Delete this product? Historical references may cause the backend to reject deletion.')) return;
    setBusy(id); setError(null);
    try { await jsonData<{deleted: true}>(`products/${id}`, 'DELETE'); await load(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not delete product.'); }
    finally { setBusy(null); }
  }
  return <AdminShell title="Products" description="Moderate product visibility using audited, state-specific commands without deleting order history.">
    {error && <ErrorNotice message={error}/>}
    {!rows ? <LoadingState label="Loading products…"/> : <Card className="overflow-x-auto">
      <table className="w-full min-w-[950px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase"><tr><th className="p-4">Product</th><th className="p-4">Status</th><th className="p-4">Price</th><th className="p-4">Stock</th><th className="p-4">Seller</th><th className="p-4">Actions</th></tr></thead>
      <tbody>{rows.map(product => <tr key={product.id} className="border-b last:border-0">
        <td className="p-4"><p className="font-medium">{product.name}</p><p className="text-xs text-slate-500">{product.sku}</p></td>
        <td className="p-4"><Badge tone={product.status === 'ACTIVE' ? 'success' : product.status === 'SUSPENDED' ? 'danger' : 'warning'}>{product.status}</Badge></td>
        <td className="p-4">{formatMoney(product.price, product.currency)}</td>
        <td className="p-4">{product.availableQuantity}</td>
        <td className="p-4 font-mono text-xs">{product.sellerId.slice(0, 8)}…</td>
        <td className="p-4"><div className="flex flex-wrap justify-end gap-2">
          {product.status === 'ACTIVE' && <Button variant="danger" size="sm" disabled={busy === product.id} onClick={() => void moderate(product, 'suspend')}>Suspend</Button>}
          {product.status === 'SUSPENDED' && <Button variant="outline" size="sm" disabled={busy === product.id} onClick={() => void moderate(product, 'reactivate')}>Reactivate</Button>}
          <Button variant="ghost" size="sm" disabled={busy === product.id} onClick={() => void remove(product.id)}>Delete</Button>
        </div></td>
      </tr>)}</tbody></table>
    </Card>}
  </AdminShell>;
}
