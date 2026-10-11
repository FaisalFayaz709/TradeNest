import { z } from 'zod';

const ApiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().trim().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().trim().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(5_000),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(30_000),
  AI_SERVICE_URL: z.string().url().default('http://127.0.0.1:8000'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().trim().min(1).default('tradenest-api'),
  JWT_AUDIENCE: z.string().trim().min(1).default('tradenest-web'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3_600).max(31_536_000).default(2_592_000),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  CATALOG_DEFAULT_CURRENCY: z.string().trim().regex(/^[A-Z]{3}$/),
  SELLER_ANALYTICS_LOW_STOCK_THRESHOLD: z.coerce.number().int().min(0).max(1_000_000).default(5),
  PAYMENT_PROVIDER: z.enum(['sandbox', 'stripe']).default('sandbox'),
  PAYMENT_STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_[A-Za-z0-9]+$/).optional(),
  PAYMENT_STRIPE_WEBHOOK_SECRET: z.string().regex(/^whsec_[A-Za-z0-9]+$/).optional(),
  PAYMENT_STRIPE_RETURN_ORIGIN: z.string().url().startsWith('https://').optional(),
  PAYMENT_SANDBOX_WEBHOOK_SECRET: z.string().min(32),
  OBSERVABILITY_METRICS_TOKEN: z.string().min(32).optional(),
  OBSERVABILITY_SLOW_REQUEST_MS: z.coerce.number().int().min(1).max(120_000).default(1_000),
});

export type ApiEnvironment = z.infer<typeof ApiEnvironmentSchema>;

export function parseApiEnvironment(environment: NodeJS.ProcessEnv): ApiEnvironment {
  const result = ApiEnvironmentSchema.safeParse(environment);

  if (result.success && result.data.PAYMENT_PROVIDER === 'stripe') {
    const cfg = result.data;
    if (!cfg.PAYMENT_STRIPE_SECRET_KEY || !cfg.PAYMENT_STRIPE_WEBHOOK_SECRET || !cfg.PAYMENT_STRIPE_RETURN_ORIGIN) {
      throw new Error('Stripe gateway requires a secret key, webhook secret and HTTPS return origin.');
    }
    const origin = new URL(cfg.PAYMENT_STRIPE_RETURN_ORIGIN!);
    if (origin.origin !== origin.href.replace(/\/$/, '') || origin.username || origin.password) {
      throw new Error('PAYMENT_STRIPE_RETURN_ORIGIN must be a plain HTTPS origin without path, query, or credentials.');
    }
    if (cfg.NODE_ENV !== 'production' && cfg.PAYMENT_STRIPE_SECRET_KEY.startsWith('sk_live_')) {
      throw new Error('A live Stripe secret key cannot be used outside production.');
    }
  }
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid TradeNest API environment: ${details}`);
  }

  return result.data;
}
