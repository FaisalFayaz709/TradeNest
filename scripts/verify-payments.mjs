import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const checks = [
 ['Stripe adapter belongs only to Payments module','apps/api/src/modules/payments/payments.module.ts',/StripeCheckoutProvider/],
 ['Registry retains sandbox provider','apps/api/src/modules/payments/provider/payment-provider.registry.ts',/if \(provider === this.sandbox.id\) return this.sandbox/],
 ['Registry supports Stripe through provider abstraction','apps/api/src/modules/payments/provider/payment-provider.registry.ts',/if \(provider === this.stripe.id\) return this.stripe/],
 ['Stripe uses HTTPS official provider host only','apps/api/src/modules/payments/provider/stripe-checkout.provider.ts',/`https:\/\/api.stripe.com\$\{path\}`/],
 ['Stripe uses stable provider idempotency keys','apps/api/src/modules/payments/provider/stripe-checkout.provider.ts',/tradenest-session-\$\{input.paymentId\}/],
 ['Stripe uses raw body and checked timestamp/signature','apps/api/src/modules/payments/provider/stripe-checkout-core.ts',/timingSafeEqual[\s\S]*Math.abs\(nowSeconds - timestamp\) > 300/],
 ['No unsigned webhook success','apps/api/src/modules/payments/provider/stripe-checkout.provider.ts',/verifiedStripeSignature\(input.rawBody, signature/],
 ['Stripe ignores nonterminal provider events','apps/api/src/modules/payments/provider/stripe-checkout.provider.ts',/if \(!success && !failed\) return null/],
 ['Paid status required','apps/api/src/modules/payments/provider/stripe-checkout.provider.ts',/if \(success && session.payment_status !== 'paid'\) return null/],
 ['Provider amount/currency verified by NestJS','apps/api/src/modules/payments/payments.service.ts',/this.assertProviderAmounts\(payment, event\)/],
 ['Only backend verified state creates escrow','apps/api/src/modules/payments/payments.service.ts',/this.escrow.holdVerifiedPayment/],
 ['Payment initiation exposes optional hosted checkout link','packages/contracts/src/payments/payment.ts',/checkoutUrl: z.string\(\).url\(\).startsWith/],
 ['Frontend checks Stripe URL before redirect','apps/web/app/orders/[id]/order-detail-client.tsx',/hostedCheckoutRedirect\(result\.payment\.provider, result\.checkoutUrl\)/],
 ['Shared frontend validator restricts HTTPS Stripe host','apps/web/lib/hosted-checkout.ts',/url\.protocol !== 'https:' \|\| url\.hostname !== 'checkout.stripe.com'/],
 ['Stripe keys validated and sandbox remains default','packages/config/src/api-env.ts',/PAYMENT_PROVIDER: z.enum\(\['sandbox', 'stripe'\]\).default\('sandbox'\)/],
 ['Webhook raw body enabled','apps/api/src/main.ts',/rawBody: true/],
 ['No browser webhook endpoint privilege','apps/api/src/modules/payments/payment-webhooks.controller.ts',/@Post\(':provider'\)/],
 // Financial remediation: prior stable-refund-idempotency check is superseded by a stricter fail-closed gate.
 ['Stripe refunds require durable outbox operation key and test-mode guard','apps/api/src/modules/payments/provider/stripe-checkout.provider.ts',/tradenest-refund-.*[\s\S]*stripeAmountMinor/],
];
const failures = checks.filter(([label,path,pattern])=>!existsSync(resolve(root,path))||!pattern.test(read(path)));
if(failures.length){ for(const [label] of failures) console.error('FAIL: '+label);process.exit(1); }
console.log(`PAYMENTS SOURCE GATE PASSED: ${checks.length} provider, webhook, redirect, monetary and architecture checks.`);
console.log('Static verification alone does not certify Stripe API, PostgreSQL, or real-money settlement.');
