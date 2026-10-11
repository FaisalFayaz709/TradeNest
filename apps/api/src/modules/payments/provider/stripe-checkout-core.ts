import { createHmac, timingSafeEqual } from 'node:crypto';

// TradeNest authoritative amounts have exactly two fraction digits. Fail closed on
// currencies without Stripe two-decimal charge semantics; never approximate.
const TWO_DECIMAL_CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'SGD', 'CHF']);

export function stripeAmountMinor(value: string, currency: string): number {
  if (!TWO_DECIMAL_CURRENCIES.has(currency)) throw new Error('STRIPE_CURRENCY_UNSUPPORTED');
  const match = /^(0|[1-9]\d{0,8})\.(\d{2})$/.exec(value);
  if (!match) throw new Error('STRIPE_AMOUNT_INVALID');
  const minor = BigInt(match[1]!) * 100n + BigInt(match[2]!);
  if (minor <= 0n || minor > 99_999_999n) throw new Error('STRIPE_AMOUNT_OUT_OF_RANGE');
  return Number(minor);
}

export function stripeAmountMajor(minor: number, currency: string): string {
  if (!TWO_DECIMAL_CURRENCIES.has(currency)) throw new Error('STRIPE_CURRENCY_UNSUPPORTED');
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > 99_999_999) throw new Error('STRIPE_AMOUNT_INVALID');
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

export function verifiedStripeSignature(
  raw: Buffer,
  header: string | undefined,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!header || raw.length === 0 || raw.length > 1024 * 1024) return false;
  const parts = header.split(',').map((part) => part.trim());
  const timestamps = parts.filter((part) => /^t=\d{1,12}$/.test(part));
  const signatures = parts.filter((part) => /^v1=[a-fA-F0-9]{64}$/.test(part));
  if (timestamps.length !== 1 || !signatures.length || signatures.length > 8) return false;
  const timestamp = Number(timestamps[0]!.slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;
  const payload = Buffer.concat([Buffer.from(`${timestamp}.`, 'utf8'), raw]);
  const expected = createHmac('sha256', secret).update(payload).digest();
  return signatures.some((part) => timingSafeEqual(Buffer.from(part.slice(3), 'hex'), expected));
}

export function trustedStripeCheckoutUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'checkout.stripe.com' &&
      parsed.username === '' && parsed.password === '' && (parsed.port === '' || parsed.port === '443');
  } catch { return false; }
}

/** Pure, independently testable fail-closed policy for the pre-Financial reconciliation gateway. */
export function stripeOperationBlockReason(
  secretKey: string | undefined,
  operation: 'charge' | 'refund',
): 'STRIPE_LIVE_MODE_NOT_APPROVED' | 'STRIPE_REFUND_RECONCILIATION_NOT_READY' | null {
  if (secretKey?.startsWith('sk_live_')) return 'STRIPE_LIVE_MODE_NOT_APPROVED';
  if (operation === 'refund' && !secretKey?.startsWith('sk_test_')) return 'STRIPE_REFUND_RECONCILIATION_NOT_READY';
  return null;
}
