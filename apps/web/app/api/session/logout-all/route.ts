import { NextRequest, NextResponse } from 'next/server';
import { authenticatedUpstream, clearSessionCookies, readEnvelope } from '@/lib/server-api';

import { rejectCrossOriginMutation } from '@/lib/mutation-origin';

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const { response: upstream } = await authenticatedUpstream(
    request,
    'auth/logout-all',
    { method: 'POST', headers: { accept: 'application/json', 'x-request-id': crypto.randomUUID() } },
  );
  const payload = await readEnvelope<unknown>(upstream);
  const response = NextResponse.json(payload, { status: upstream.status });
  clearSessionCookies(response);
  return response;
}
