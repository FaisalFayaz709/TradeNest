'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin/admin-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiCollection } from '@/lib/api-client';
import { moderateResource } from '@/lib/admin-moderation';
import type { AdminSellerSummary } from '@/lib/api-types';

export default function AdminSellersPage() {
  const [rows, setRows] = useState<AdminSellerSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setRows((await apiCollection<AdminSellerSummary>('admin/sellers?page=1&limit=100')).data); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not load sellers.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function moderate(seller: AdminSellerSummary, action: 'suspend' | 'reactivate') {
    setError(null); setBusy(seller.userId);
    try {
      const changed = await moderateResource<AdminSellerSummary>('sellers', seller.userId, action);
      if (changed) await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Seller moderation failed.'); }
    finally { setBusy(null); }
  }
  return <AdminShell title="Sellers" description="Audited seller suspension/reactivation. Suspended stores are excluded from public discovery and new purchases.">
    {error && <ErrorNotice message={error}/>}
    {!rows ? <LoadingState label="Loading sellers…"/> :
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map(seller => <Card key={seller.userId} className="p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{seller.storeName}</h2><p className="mt-1 text-xs text-slate-500">{seller.slug}</p></div><Badge tone={seller.status === 'ACTIVE' ? 'success' : 'warning'}>{seller.status}</Badge></div>
        <p className="mt-4 text-sm">Rating: {seller.rating === null ? 'No rating' : `${seller.rating.toFixed(1)}/5`}</p>
        <div className="mt-4">{seller.status === 'ACTIVE' && <Button variant="danger" size="sm" disabled={busy === seller.userId} onClick={() => void moderate(seller, 'suspend')}>Suspend store</Button>}
          {seller.status === 'SUSPENDED' && <Button variant="outline" size="sm" disabled={busy === seller.userId} onClick={() => void moderate(seller, 'reactivate')}>Reactivate store</Button>}</div>
      </Card>)}</div>}
  </AdminShell>;
}
