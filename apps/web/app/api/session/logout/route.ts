import { NextRequest, NextResponse } from 'next/server';
import { accessToken, apiFetch, clearSessionCookies, readEnvelope } from '@/lib/server-api';

import { rejectCrossOriginMutation } from '@/lib/mutation-origin';

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const token = accessToken(request);
  if (token) {
    const upstream = await apiFetch('auth/logout', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'x-request-id': crypto.randomUUID() },
    });
    const payload = await readEnvelope<unknown>(upstream);
    const response = NextResponse.json(payload, { status: upstream.ok ? 200 : upstream.status });
    clearSessionCookies(response);
    return response;
  }
  const response = NextResponse.json({ data: { revoked: false } });
  clearSessionCookies(response);
  return response;
}
