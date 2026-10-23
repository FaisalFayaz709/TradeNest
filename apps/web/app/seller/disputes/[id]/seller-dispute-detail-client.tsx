'use client';

import Link from 'next/link';
import { FilePlus2, MessageSquarePlus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
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
import type { Dispute } from '@/lib/api-types';

export function SellerDisputeDetailClient() { const params = useParams<{ id: string }>(); const id = params.id || ''; return <SellerShell title="Dispute detail" description="Seller participation is limited to viewing, messaging, and evidence. Only Admin can resolve the financial outcome."><Detail key={id} id={id} /></SellerShell>; }
function Detail({ id }: { id: string }) {
  const [dispute, setDispute] = useState<Dispute | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setDispute(await apiData<Dispute>(`disputes/${id}`)); } catch (value) { setError(value instanceof Error ? value.message : 'Could not load dispute.'); } finally { setLoading(false); } }, [id]);
  useEffect(() => {
    let active = true;

    void apiData<Dispute>(`disputes/${id}`)
      .then((value) => {
        if (!active) return;
        setDispute(value);
        setError(null);
      })
      .catch((value: unknown) => {
        if (active) setError(value instanceof Error ? value.message : 'Could not load dispute.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);
  if (loading) return <LoadingState label="Loading dispute…" />; if (error && !dispute) return <ErrorNotice message={error} />; if (!dispute) return null;
  return <div className="grid gap-6"><div><Link href="/seller/disputes" className="text-sm font-medium text-[var(--tradenest-blue)] hover:underline">← Back to disputes</Link><div className="mt-3 flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold text-[var(--tradenest-navy)]">{dispute.reason}</h2><Badge tone={dispute.status === 'OPEN' ? 'warning' : 'success'}>{dispute.status}</Badge>{dispute.resolution ? <Badge tone={dispute.resolution === 'REFUND_BUYER' ? 'danger' : 'success'}>{dispute.resolution.replaceAll('_', ' ')}</Badge> : null}</div><p className="mt-2 text-sm leading-6 text-[var(--tradenest-text-secondary)]">{dispute.description}</p></div>{error ? <ErrorNotice message={error} /> : null}<div className="grid gap-6 lg:grid-cols-2"><Card className="p-5"><h3 className="font-semibold text-[var(--tradenest-navy)]">Conversation</h3><div className="mt-4 grid max-h-80 gap-3 overflow-auto">{dispute.messages.map((message) => <div key={message.id} className="rounded-xl bg-slate-50 p-3"><p className="text-sm">{message.body}</p><p className="mt-1 text-xs text-[var(--tradenest-text-secondary)]">{new Date(message.createdAt).toLocaleString()}</p></div>)}{!dispute.messages.length ? <p className="text-sm text-[var(--tradenest-text-secondary)]">No messages yet.</p> : null}</div>{dispute.status === 'OPEN' ? <MessageForm id={dispute.id} refresh={() => void load()} /> : null}</Card><Card className="p-5"><h3 className="font-semibold text-[var(--tradenest-navy)]">Evidence</h3><div className="mt-4 grid gap-3">{dispute.evidence.map((item) => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="rounded-xl border border-[var(--tradenest-border)] p-3 text-sm font-medium text-[var(--tradenest-blue)] hover:bg-slate-50">{item.fileName || item.objectKey}</a>)}{!dispute.evidence.length ? <p className="text-sm text-[var(--tradenest-text-secondary)]">No evidence uploaded.</p> : null}</div>{dispute.status === 'OPEN' ? <EvidenceForm id={dispute.id} refresh={() => void load()} /> : null}</Card></div></div>;
}
function MessageForm({ id, refresh }: { id: string; refresh: () => void }) { const [body, setBody] = useState(''); const [busy, setBusy] = useState(false); async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await jsonData(`disputes/${id}/messages`, 'POST', { body }); setBody(''); refresh(); } finally { setBusy(false); } } return <form onSubmit={submit} className="mt-4 grid gap-2 border-t border-[var(--tradenest-border)] pt-4"><Textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add a factual case message…" maxLength={5000} required /><Button type="submit" variant="outline" disabled={busy}><MessageSquarePlus className="size-4" />Add message</Button></form>; }
function EvidenceForm({ id, refresh }: { id: string; refresh: () => void }) {
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!file) return; setBusy(true); setError(null);
    try {
      const objectKey = await uploadManagedFile('disputes', id, file);
      await jsonData(`disputes/${id}/evidence`, 'POST', { objectKey, fileName: file.name, mimeType: file.type });
      setFile(null); refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Could not upload evidence.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-4 grid gap-2 border-t border-[var(--tradenest-border)] pt-4">
    <label className="text-sm font-medium">Evidence file (JPEG, PNG, WebP or PDF, up to 10 MB)
      <Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
    </label>
    {error ? <ErrorNotice message={error} /> : null}
    <Button type="submit" variant="outline" disabled={busy || !file}><FilePlus2 className="size-4" />{busy ? 'Uploading…' : 'Upload evidence'}</Button>
  </form>;
}
