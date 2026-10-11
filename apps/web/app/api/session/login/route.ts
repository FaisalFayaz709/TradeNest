import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, readEnvelope, setSessionCookies, type SessionPayload } from '@/lib/server-api';

import { rejectCrossOriginMutation } from '@/lib/mutation-origin';

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const body = await request.text();
  const upstream = await apiFetch('auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', 'x-request-id': crypto.randomUUID() },
    body,
  });
  const payload = await readEnvelope<SessionPayload>(upstream);
  const response = NextResponse.json(
    upstream.ok && payload.data ? { data: { user: payload.data.user } } : payload,
    { status: upstream.status },
  );
  response.headers.set('cache-control', 'no-store');
  if (upstream.ok && payload.data) setSessionCookies(response, payload.data.tokens);
  return response;
}
