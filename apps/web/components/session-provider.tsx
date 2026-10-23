'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@/lib/api-types';

type SessionState = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

async function fetchSessionUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch('/api/session/me', { cache: 'no-store' });
    if (!response.ok) return null;

    const payload = (await response.json()) as { data?: AuthUser };
    return payload.data || null;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await fetchSessionUser());
  }, []);

  useEffect(() => {
    let active = true;

    void fetchSessionUser().then((currentUser) => {
      if (!active) return;
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/session/logout', { method: 'POST' });
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, logout }), [user, loading, refresh, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider.');
  return context;
}
