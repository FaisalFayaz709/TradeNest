import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE = 'tradenest_access';
const REFRESH_COOKIE = 'tradenest_refresh';

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN';
};

export type SessionPayload = { user: SessionUser; tokens: SessionTokens };

type ApiEnvelope<T> = { data?: T; error?: { code?: string; message?: string; details?: Record<string, unknown>; requestId?: string } };

export function apiBase(): string {
  const raw = process.env.TRADENEST_API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:4000/api/v1';
  return raw.replace(/\/+$/, '');
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${apiBase()}/${path.replace(/^\/+/, '')}`, { ...init, cache: 'no-store' });
}

export async function readEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    return { error: { code: 'UPSTREAM_RESPONSE_INVALID', message: 'The marketplace API returned an unreadable response.' } };
  }
}

export function accessToken(request: NextRequest): string | null {
  return request.cookies.get(ACCESS_COOKIE)?.value || null;
}

export function refreshToken(request: NextRequest): string | null {
  return request.cookies.get(REFRESH_COOKIE)?.value || null;
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function setSessionCookies(response: NextResponse, tokens: SessionTokens): void {
  const common = { httpOnly: true, sameSite: 'lax' as const, secure: cookieSecure(), path: '/' };
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, { ...common, maxAge: tokens.accessTokenExpiresIn });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, { ...common, maxAge: tokens.refreshTokenExpiresIn });
}

export function clearSessionCookies(response: NextResponse): void {
  const common = { httpOnly: true, sameSite: 'lax' as const, secure: cookieSecure(), path: '/', maxAge: 0 };
  response.cookies.set(ACCESS_COOKIE, '', common);
  response.cookies.set(REFRESH_COOKIE, '', common);
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SessionPayload>;
  return Boolean(
    candidate.user && typeof candidate.user.id === 'string' && typeof candidate.user.email === 'string' &&
    typeof candidate.user.name === 'string' && ['BUYER', 'SELLER', 'ADMIN'].includes(candidate.user.role || '') &&
    candidate.tokens && typeof candidate.tokens.accessToken === 'string' && typeof candidate.tokens.refreshToken === 'string' &&
    typeof candidate.tokens.accessTokenExpiresIn === 'number' && typeof candidate.tokens.refreshTokenExpiresIn === 'number',
  );
}

export async function refreshSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = refreshToken(request);
  if (!token) return null;
  const response = await apiFetch('auth/refresh', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  });
  if (!response.ok) return null;
  const envelope = await readEnvelope<unknown>(response);
  return isSessionPayload(envelope.data) ? envelope.data : null;
}

export async function authenticatedUpstream(
  request: NextRequest,
  path: string,
  init: RequestInit,
  optionalAuth = false,
): Promise<{ response: Response; rotated: SessionPayload | null }> {
  const token = accessToken(request);
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  let upstream = await apiFetch(path, { ...init, headers });

  if (upstream.status !== 401 || (!token && optionalAuth)) return { response: upstream, rotated: null };
  const rotated = await refreshSession(request);
  if (!rotated) return { response: upstream, rotated: null };

  const retryHeaders = new Headers(init.headers);
  retryHeaders.set('authorization', `Bearer ${rotated.tokens.accessToken}`);
  upstream = await apiFetch(path, { ...init, headers: retryHeaders });
  return { response: upstream, rotated };
}

export function relayResponse(upstream: Response, body: string): NextResponse {
  const headers = new Headers();
  headers.set('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
  for (const name of ['retry-after', 'x-request-id', 'x-ratelimit-policy']) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('cache-control', 'no-store');
  return new NextResponse(body, { status: upstream.status, headers });
}
