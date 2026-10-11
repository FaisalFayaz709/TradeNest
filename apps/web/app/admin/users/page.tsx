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
import type { UserProfile } from '@/lib/api-types';

export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setRows((await apiCollection<UserProfile>('admin/users?page=1&limit=100')).data); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not load users.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function moderate(user: UserProfile, action: 'suspend' | 'reactivate') {
    setError(null); setBusy(user.id);
    try {
      const changed = await moderateResource<UserProfile>('users', user.id, action);
      if (changed) await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'User moderation failed.'); }
    finally { setBusy(null); }
  }
  return <AdminShell title="Users" description="Manage accounts with explicit, audited suspension and reactivation. Administrator accounts cannot be moderated here.">
    {error && <ErrorNotice message={error}/>}
    {!rows ? <LoadingState label="Loading users…"/> :
      <Card className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase"><tr><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4">Verified</th><th className="p-4">Actions</th></tr></thead>
        <tbody>{rows.map(user => <tr key={user.id} className="border-b last:border-0">
          <td className="p-4"><p className="font-medium">{user.name}</p><p className="text-xs text-slate-500">{user.email}</p></td>
          <td className="p-4">{user.role}</td>
          <td className="p-4"><Badge tone={user.status === 'ACTIVE' ? 'success' : 'warning'}>{user.status}</Badge></td>
          <td className="p-4">{user.emailVerifiedAt ? 'Yes' : 'No'}</td>
          <td className="p-4">{user.role !== 'ADMIN' && user.status === 'ACTIVE' && <Button size="sm" variant="danger" disabled={busy === user.id} onClick={() => void moderate(user, 'suspend')}>Suspend</Button>}
            {user.role !== 'ADMIN' && user.status === 'SUSPENDED' && <Button size="sm" variant="outline" disabled={busy === user.id} onClick={() => void moderate(user, 'reactivate')}>Reactivate</Button>}</td>
        </tr>)}</tbody>
      </table></Card>}
  </AdminShell>;
}
