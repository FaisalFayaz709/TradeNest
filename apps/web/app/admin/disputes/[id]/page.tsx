'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AdminShell } from '@/components/admin/admin-shell';
import { ErrorNotice } from '@/components/error-notice';
import { LoadingState } from '@/components/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiData, apiRequest, idempotencyKey } from '@/lib/api-client';
import type { Dispute } from '@/lib/api-types';

export default function AdminDisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  // A different dispute gets a separate component and idempotency-key scope.
  return <DisputeDetail key={id} id={id} />;
}

function DisputeDetail({ id }: { id: string }) {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [refundPending, setRefundPending] = useState(false);
  const busyRef = useRef(false);
  const keys = useRef(new Map<string, string>());

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await apiData<Dispute>(`disputes/${id}`);
        if (active) setDispute(result);
      } catch (value) {
        if (active) setError(value instanceof Error ? value.message : 'Could not load dispute.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  async function resolve(resolution: 'REFUND_BUYER' | 'RELEASE_TO_SELLER') {
    if (!id || busyRef.current || dispute?.status !== 'OPEN') return;
    busyRef.current = true;
    setBusy(resolution);
    setError(null);
    const key = keys.current.get(resolution) || idempotencyKey(`admin-dispute-${id}-${resolution.toLowerCase()}`);
    keys.current.set(resolution, key);
    try {
      const outcome = await apiRequest<{ data: Dispute; meta?: { financialOutcome?: string } }>(
        `admin/disputes/${id}/resolve`,
        { method: 'POST', body: JSON.stringify({ resolution }), headers: { 'Idempotency-Key': key } },
      );
      // A successful refund command means QUEUED, not refunded: the provider's
      // confirmed outcome is applied later by the escrow reconciler.
      if (outcome.meta?.financialOutcome === 'PENDING_PROVIDER_CONFIRMATION') setRefundPending(true);
      setDispute(await apiData<Dispute>(`disputes/${id}`));
      keys.current.delete(resolution);
    } catch (value) {
      // Keep the same key after an ambiguous failure, so retries are idempotent.
      setError(value instanceof Error ? value.message : 'Could not resolve dispute.');
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  return (
    <AdminShell title="Dispute review" description="Resolution is transactional, idempotent, ledger-backed, and audited by the existing backend workflow.">
      {error ? <ErrorNotice message={error} /> : null}
      {loading ? <LoadingState label="Loading dispute…" /> : !dispute ? (
        <p className="text-sm text-[var(--tradenest-text-secondary)]">Dispute details are not available.</p>
      ) : (
        <div className="grid gap-5">
          <Card className="p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="break-words text-xl font-semibold text-[var(--tradenest-navy)]">{dispute.reason}</h2>
                <p className="mt-1 break-all text-xs text-[var(--tradenest-text-secondary)]">Order {dispute.orderId}</p>
              </div>
              <Badge tone={dispute.status === 'OPEN' ? 'warning' : 'success'}>{dispute.status}</Badge>
            </div>
            <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-6">{dispute.description}</p>
            {dispute.status === 'OPEN' && refundPending ? (
              <p role="status" className="mt-6 text-sm text-[var(--tradenest-text-secondary)]">
                Refund requested. Awaiting payment provider confirmation; this dispute is not yet resolved.
              </p>
            ) : dispute.status === 'OPEN' ? (
              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="danger" disabled={busy !== null} onClick={() => void resolve('REFUND_BUYER')}>
                  {busy === 'REFUND_BUYER' ? 'Resolving…' : 'Refund buyer'}
                </Button>
                <Button variant="secondary" disabled={busy !== null} onClick={() => void resolve('RELEASE_TO_SELLER')}>
                  {busy === 'RELEASE_TO_SELLER' ? 'Resolving…' : 'Release to seller'}
                </Button>
              </div>
            ) : (
              <p className="mt-5 text-sm font-medium text-[var(--tradenest-navy)]">Resolution: {dispute.resolution?.replaceAll('_', ' ')}</p>
            )}
          </Card>
          <Card className="p-4 sm:p-6">
            <h2 className="font-semibold text-[var(--tradenest-navy)]">Conversation</h2>
            <div className="mt-4 grid gap-3">
              {dispute.messages.length ? dispute.messages.map((message) => (
                <div key={message.id} className="min-w-0 rounded-xl bg-slate-50 p-4">
                  <p className="break-words text-xs text-[var(--tradenest-text-secondary)]">{message.authorId.slice(0, 12)}… · {new Date(message.createdAt).toLocaleString()}</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p>
                </div>
              )) : <p className="text-sm text-[var(--tradenest-text-secondary)]">No messages.</p>}
            </div>
          </Card>
          <Card className="p-4 sm:p-6">
            <h2 className="font-semibold text-[var(--tradenest-navy)]">Evidence</h2>
            <div className="mt-4 grid gap-2">
              {dispute.evidence.length ? dispute.evidence.map((evidence) => (
                <a key={evidence.id} href={evidence.url} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-[var(--tradenest-blue)] hover:underline">
                  {evidence.fileName || evidence.objectKey}
                </a>
              )) : <p className="text-sm text-[var(--tradenest-text-secondary)]">No evidence uploaded.</p>}
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
