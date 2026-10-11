import { NextRequest, NextResponse } from 'next/server';
import { authenticatedUpstream, clearSessionCookies, readEnvelope, setSessionCookies, type SessionUser } from '@/lib/server-api';

export async function GET(request: NextRequest) {
  const { response: upstream, rotated } = await authenticatedUpstream(
    request,
    'auth/me',
    { method: 'GET', headers: { accept: 'application/json', 'x-request-id': crypto.randomUUID() } },
  );
  const payload = await readEnvelope<SessionUser>(upstream);
  const response = NextResponse.json(payload, { status: upstream.status });
  response.headers.set('cache-control', 'no-store');
  if (rotated) setSessionCookies(response, rotated.tokens);
  if (upstream.status === 401 && !rotated) clearSessionCookies(response);
  return response;
}
