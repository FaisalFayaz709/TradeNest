type Role = 'BUYER' | 'SELLER' | 'ADMIN';

type RequestBody = {
  role: Role;
  email: string;
  password: string;
};

const probes: Record<Role, string> = {
  BUYER: '/users/me',
  SELLER: '/seller/analytics',
  ADMIN: '/admin/fraud-alerts?limit=1',
};

function enabled(): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.TRADENEST_E2E_UI !== '1') return false;
  // Refuse to make this diagnostic endpoint a bridge to a remote API.
  try {
    const base = new URL(process.env.TRADENEST_E2E_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1');
    return base.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  } catch {
    return false;
  }
}

function validBody(value: unknown): value is RequestBody {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RequestBody>;
  return ['BUYER', 'SELLER', 'ADMIN'].includes(candidate.role ?? '')
    && typeof candidate.email === 'string'
    && candidate.email.length > 3
    && typeof candidate.password === 'string'
    && candidate.password.length > 0;
}

export async function POST(request: Request): Promise<Response> {
  if (!enabled()) return Response.json({ error: 'Not found.' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (!validBody(body)) return Response.json({ error: 'Invalid E2E workflow request.' }, { status: 400 });

  const apiBase = (process.env.TRADENEST_E2E_API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
  const login = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'TradeNest-Playwright-E2E' },
    body: JSON.stringify({ email: body.email, password: body.password }),
    cache: 'no-store',
  });
  const loginPayload = await login.json() as any;
  if (!login.ok) return Response.json({ error: 'NestJS login failed.', upstream: loginPayload }, { status: login.status });

  const session = loginPayload?.data;
  if (!session?.tokens?.accessToken || session?.user?.role !== body.role) {
    return Response.json({ error: 'Seeded role does not match the requested E2E role.' }, { status: 409 });
  }

  const probe = await fetch(`${apiBase}${probes[body.role]}`, {
    headers: { authorization: `Bearer ${session.tokens.accessToken}`, 'user-agent': 'TradeNest-Playwright-E2E' },
    cache: 'no-store',
  });
  const probePayload = await probe.json();
  if (!probe.ok) return Response.json({ error: 'Role-specific NestJS probe failed.', upstream: probePayload }, { status: probe.status });

  return Response.json({
    data: {
      role: body.role,
      user: { email: session.user.email, role: session.user.role },
      probe: probePayload?.data ?? probePayload,
    },
  });
}
