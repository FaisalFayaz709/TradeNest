/**
 * Security: CSRF boundary for the Next.js cookie-authenticated web surface.
 * The NestJS REST API continues to use bearer JWTs; this guard protects only
 * the browser-facing, cookie-backed proxy and session routes.
 *
 * Reverse proxies must preserve the external request origin in NextRequest.url.
 */
type MutationRequest = Pick<Request, 'method' | 'url' | 'headers'>;

export function isSameOriginMutation(request: MutationRequest): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method.toUpperCase())) return true;

  // Both browsers' Fetch Metadata and the Origin header are evaluated.  Never
  // trust a same-site sibling subdomain with the user's session cookies.
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') return false;

  const origin = request.headers.get('origin');
  if (!origin) return fetchSite === 'same-origin';
  try {
    const parsed = new URL(origin);
    if (!['https:', 'http:'].includes(parsed.protocol)) return false;
    // Forbid path, query, username, port or other text masquerading as Origin.
    if (parsed.origin !== origin) return false;
    return parsed.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function rejectCrossOriginMutation(request: MutationRequest): Response | null {
  if (isSameOriginMutation(request)) return null;
  return Response.json({
    error: {
      code: 'WEB_MUTATION_ORIGIN_FORBIDDEN',
      message: 'This change must be requested from the TradeNest web origin.',
    },
  }, {
    status: 403,
    headers: { 'Cache-Control': 'no-store', 'Vary': 'Origin, Sec-Fetch-Site' },
  });
}
