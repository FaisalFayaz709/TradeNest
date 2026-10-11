import { NextRequest, NextResponse } from 'next/server';
import { apiFetch, authenticatedUpstream, clearSessionCookies, relayResponse, setSessionCookies } from '@/lib/server-api';
import { rejectCrossOriginMutation } from '@/lib/mutation-origin';

type RouteRule = { methods: readonly string[]; pattern: RegExp; optionalAuth?: boolean };

const uuid = '[0-9a-fA-F-]{36}';
const rules: RouteRule[] = [
  { methods: ['GET'], pattern: /^categories$/, optionalAuth: true },
  { methods: ['GET'], pattern: /^products$/, optionalAuth: true },
  { methods: ['GET'], pattern: /^products\/[^/]+$/, optionalAuth: true },
  { methods: ['GET'], pattern: new RegExp(`^products\/${uuid}\/reviews$`), optionalAuth: true },
  // Frontend: public managed image delivery must retain its binary response.
  { methods: ['GET'], pattern: new RegExp(`^products\/${uuid}\/images\/${uuid}\/file$`), optionalAuth: true },
  { methods: ['GET'], pattern: /^ai\/recommendations$/ },
  { methods: ['GET'], pattern: new RegExp(`^ai\/recommendations\/products\/${uuid}$`), optionalAuth: true },
  { methods: ['POST'], pattern: /^events$/, optionalAuth: true },
  { methods: ['GET', 'DELETE'], pattern: /^cart$/ },
  { methods: ['POST'], pattern: /^cart\/items$/ },
  { methods: ['PATCH', 'DELETE'], pattern: new RegExp(`^cart\/items\/${uuid}$`) },
  { methods: ['POST'], pattern: /^checkout\/quote$/ },
  { methods: ['POST'], pattern: /^checkout$/ },
  { methods: ['GET'], pattern: /^orders$/ },
  { methods: ['GET'], pattern: new RegExp(`^orders\/${uuid}$`) },
  { methods: ['POST'], pattern: new RegExp(`^orders\/${uuid}\/(?:cancel|confirm-delivery)$`) },
  { methods: ['POST'], pattern: new RegExp(`^orders\/${uuid}\/payments$`) },
  { methods: ['GET'], pattern: new RegExp(`^orders\/${uuid}\/escrow$`) },
  { methods: ['GET'], pattern: new RegExp(`^orders\/${uuid}\/shipment$`) },
  { methods: ['POST'], pattern: new RegExp(`^orders\/${uuid}\/disputes$`) },
  { methods: ['POST'], pattern: new RegExp(`^orders\/${uuid}\/reviews$`) },
  { methods: ['GET'], pattern: new RegExp(`^payments\/${uuid}$`) },
  { methods: ['GET'], pattern: /^wishlist$/ },
  { methods: ['POST', 'DELETE'], pattern: new RegExp(`^wishlist\/${uuid}$`) },
  { methods: ['GET', 'PATCH', 'DELETE'], pattern: /^users\/me$/ },
  { methods: ['GET', 'POST'], pattern: /^users\/me\/addresses$/ },
  { methods: ['PATCH', 'DELETE'], pattern: new RegExp(`^users\/me\/addresses\/${uuid}$`) },
  { methods: ['POST'], pattern: /^seller\/onboard$/ },
  { methods: ['GET', 'PATCH'], pattern: /^seller\/profile$/ },
  { methods: ['GET'], pattern: /^seller\/dashboard$/ },
  { methods: ['GET'], pattern: /^seller\/products$/ },
  { methods: ['POST'], pattern: new RegExp(`^seller\/products\/${uuid}\/price-suggestion$`) },
  { methods: ['GET'], pattern: /^seller\/ai-insights$/ },
  { methods: ['GET'], pattern: /^seller\/orders$/ },
  { methods: ['GET'], pattern: /^seller\/analytics(?:\/(?:overview|revenue))?$/ },
  { methods: ['GET'], pattern: /^seller\/disputes$/ },
  { methods: ['GET'], pattern: /^admin\/(?:dashboard|users|sellers|products|orders|payments|escrows|disputes)$/ },
  { methods: ['GET'], pattern: /^admin\/fraud-alerts$/ },
  { methods: ['POST'], pattern: new RegExp(`^admin\/disputes\/${uuid}\/resolve$`) },
  { methods: ['POST'], pattern: /^products$/ },
  { methods: ['PATCH', 'DELETE'], pattern: new RegExp(`^products\/${uuid}$`) },
  { methods: ['POST'], pattern: new RegExp(`^products\/${uuid}\/images$`) },
  { methods: ['POST'], pattern: new RegExp(`^products\/${uuid}\/images\/upload-url$`) },
  { methods: ['PATCH'], pattern: new RegExp(`^products\/${uuid}\/inventory$`) },
  { methods: ['POST'], pattern: new RegExp(`^products\/${uuid}\/(?:publish|archive)$`) },
  { methods: ['POST'], pattern: new RegExp(`^orders\/${uuid}\/shipment$`) },
  { methods: ['GET'], pattern: new RegExp(`^ai\/pricing\/products\/${uuid}$`) },
  { methods: ['GET'], pattern: new RegExp(`^disputes\/${uuid}$`) },
  { methods: ['POST'], pattern: new RegExp(`^disputes\/${uuid}\/(?:messages|evidence)$`) },
  { methods: ['POST'], pattern: new RegExp(`^disputes\/${uuid}\/evidence\/upload-url$`) },
  // Admin audited commands and Notifications protected in-app notifications.
  { methods: ['POST'], pattern: new RegExp(`^admin\/(?:users|sellers|products)\/${uuid}\/(?:suspend|reactivate)$`) },
  { methods: ['GET'], pattern: /^notifications$/ },
  { methods: ['GET'], pattern: /^notifications\/unread-count$/ },
  { methods: ['PATCH'], pattern: /^notifications\/read-all$/ },
  { methods: ['PATCH'], pattern: new RegExp(`^notifications\/${uuid}\/read$`) },
  { methods: ['POST'], pattern: /^auth\/change-password$/ },
];

function allowed(method: string, path: string): RouteRule | null {
  return rules.find((rule) => rule.methods.includes(method) && rule.pattern.test(path)) || null;
}

async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const rejected = rejectCrossOriginMutation(request);
  if (rejected) return rejected;
  const { path: segments } = await context.params;
  const path = segments.join('/');
  const rule = allowed(request.method, path);
  if (!rule) return Response.json({ error: { code: 'WEB_PROXY_ROUTE_FORBIDDEN', message: 'This API route is not available through the TradeNest web surface.', details: {}, requestId: crypto.randomUUID() } }, { status: 403 });

  // Public catalog image bytes are identical for every viewer. Never forward
  // session cookies or attach rotated credentials to a publicly cached image.
  if (request.method === 'GET' && new RegExp(`^products\/${uuid}\/images\/${uuid}\/file$`).test(path)) {
    const image = await apiFetch(`${path}${request.nextUrl.search}`, {
      method: 'GET', headers: { accept: 'image/*', 'x-request-id': crypto.randomUUID() },
    });
    if (!image.ok) return relayResponse(image, await image.text());
    return new NextResponse(image.body, {
      status: image.status,
      headers: {
        'Content-Type': image.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  const headers = new Headers();
  headers.set('accept', 'application/json');
  headers.set('x-request-id', request.headers.get('x-request-id') || crypto.randomUUID());
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const idempotency = request.headers.get('idempotency-key');
  if (idempotency) headers.set('idempotency-key', idempotency);

  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  const query = request.nextUrl.search;
  const { response: upstream, rotated } = await authenticatedUpstream(
    request,
    `${path}${query}`,
    { method: request.method, headers, ...(body ? { body } : {}) },
    Boolean(rule.optionalAuth),
  );
  const text = await upstream.text();
  const response = relayResponse(upstream, text);
  if (rotated) setSessionCookies(response, rotated.tokens);
  if (upstream.status === 401 && !rotated) clearSessionCookies(response);
  return response;
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
