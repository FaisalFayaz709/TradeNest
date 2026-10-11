'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useSession } from '@/components/session-provider';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { apiCollection, jsonData } from '@/lib/api-client';

type Notice = { id: string; type: string; title: string; body: string; readAt: string | null; createdAt: string };

export default function NotificationsPage() {
  const { user, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<Notice[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (current: number) => {
    setLoading(true); setError(null);
    try {
      const data = await apiCollection<Notice>(`notifications?page=${current}&limit=20`);
      setItems(data.data); setPages(data.meta.totalPages); setPage(current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Notifications could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (user) void load(1); else { setItems([]); setPage(1); } }, [user?.id, load]);
  const action = async (id?: string) => {
    setBusy(true); setError(null);
    try {
      await jsonData(id ? `notifications/${id}/read` : 'notifications/read-all', 'PATCH');
      await load(page);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update notifications.'); }
    finally { setBusy(false); }
  };
  return <PageShell eyebrow="Account" title="Notifications" description="Order, payment, delivery, dispute and account activity recorded by TradeNest.">
    {sessionLoading ? <LoadingState label="Checking session…" /> : !user ? <Card className="p-6">Sign in to view your notifications.</Card> : <div className="space-y-4">
      <div className="flex justify-end"><Button variant="outline" disabled={busy || !items.some(item => !item.readAt)} onClick={() => void action()}><CheckCheck className="mr-2 size-4" /> Mark all read</Button></div>
      {error ? <ErrorNotice message={error} /> : null}
      {loading ? <LoadingState label="Loading notifications…" /> : items.length === 0 ? <Card className="p-8 text-center"><Bell className="mx-auto mb-3 size-8 text-slate-400" /><p>No notifications yet.</p></Card> :
      <div className="space-y-3">{items.map(item => <Card key={item.id} className={`p-5 ${!item.readAt ? 'border-[var(--tradenest-teal)]' : ''}`}>
        <div className="flex items-start justify-between gap-4"><div><div className="font-semibold">{item.title}</div><p className="mt-1 text-sm text-[var(--tradenest-text-secondary)]">{item.body}</p><p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">{new Date(item.createdAt).toLocaleString()}</p></div>
        {!item.readAt ? <Button variant="outline" size="sm" disabled={busy} onClick={() => void action(item.id)}>Mark read</Button> : <span className="text-xs text-slate-400">Read</span>}</div>
      </Card>)}</div>}
      <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={loading || page <= 1} onClick={() => void load(page-1)}>Previous</Button><span className="text-sm">Page {page} / {Math.max(pages, 1)}</span><Button variant="outline" disabled={loading || page >= pages} onClick={() => void load(page+1)}>Next</Button></div>
    </div>}
  </PageShell>;
}
