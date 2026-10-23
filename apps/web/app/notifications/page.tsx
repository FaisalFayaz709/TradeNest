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
  return (
    <PageShell eyebrow="Account" title="Notifications" description="Order, payment, delivery, dispute and account activity recorded by TradeNest.">
      {sessionLoading ? <LoadingState label="Checking session…" /> : !user ? (
        <Card className="p-6">Sign in to view your notifications.</Card>
      ) : (
        // Remount on account changes so results from another session are never displayed.
        <NotificationsContent key={user.id} />
      )}
    </PageShell>
  );
}

function NotificationsContent() {
  const [items, setItems] = useState<Notice[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (current: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCollection<Notice>(`notifications?page=${current}&limit=20`);
      setItems(result.data);
      setPages(result.meta.totalPages);
      setPage(current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    // The initial API request starts in the effect, but state only changes in its
    // asynchronous callbacks. Manual refreshes use load() from click handlers.
    void apiCollection<Notice>('notifications?page=1&limit=20')
      .then((result) => {
        if (!active) return;
        setItems(result.data);
        setPages(result.meta.totalPages);
        setPage(1);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Notifications could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function action(id?: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await jsonData(id ? `notifications/${id}/read` : 'notifications/read-all', 'PATCH');
      await load(page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update notifications.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" disabled={busy || loading || !items.some((item) => !item.readAt)} onClick={() => void action()}>
          <CheckCheck className="mr-2 size-4" /> Mark all read
        </Button>
      </div>
      {error ? <ErrorNotice message={error} /> : null}
      {loading ? <LoadingState label="Loading notifications…" /> : items.length === 0 ? (
        <Card className="p-8 text-center"><Bell className="mx-auto mb-3 size-8 text-slate-400" /><p>No notifications yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className={`p-4 sm:p-5 ${!item.readAt ? 'border-[var(--tradenest-teal)]' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
                <div className="min-w-0">
                  <h2 className="break-words font-semibold">{item.title}</h2>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--tradenest-text-secondary)]">{item.body}</p>
                  <p className="mt-2 text-xs text-[var(--tradenest-text-secondary)]">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
                {!item.readAt ? (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void action(item.id)}>Mark read</Button>
                ) : <span className="text-xs text-slate-400">Read</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
      <nav aria-label="Notification pages" className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" disabled={loading || busy || page <= 1} onClick={() => void load(page - 1)}>Previous</Button>
        <span className="text-sm">Page {page} / {Math.max(pages, 1)}</span>
        <Button variant="outline" disabled={loading || busy || page >= pages} onClick={() => void load(page + 1)}>Next</Button>
      </nav>
    </div>
  );
}
