/** Financial remediation offline, dependency-free remediation audit (NOT runtime certification). */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const get = (path) => readFileSync(resolve(root, path), 'utf8');
const errors = [];
const requireText = (path, tokens) => {
  if (!existsSync(resolve(root, path))) { errors.push(`Missing ${path}`); return; }
  const src = get(path);
  for (const token of tokens) if (!src.includes(token)) errors.push(`${path} missing ${token}`);
};
requireText('apps/web/components.json', ['"style": "new-york"', '"cssVariables": true']);
requireText('apps/web/package.json', ['"@radix-ui/react-slot"', '"class-variance-authority"', '"tailwind-merge"']);
requireText('apps/web/lib/cn.ts', ['twMerge(clsx(inputs))']);
requireText('apps/web/components/ui/button.tsx', ['@radix-ui/react-slot', 'cva(', 'buttonVariants', 'React.forwardRef', 'asChild']);
requireText('apps/web/components/ui/badge.tsx', ['cva(', 'badgeVariants', 'React.forwardRef']);
for (const name of ['card', 'input', 'textarea']) requireText(`apps/web/components/ui/${name}.tsx`, ['React.forwardRef', '@/lib/utils']);
requireText('apps/web/app/globals.css', ['--tradenest-navy: #0b2a4a;', '--tradenest-teal: #0fa3a3;', '--tradenest-gold: #d6a84b;']);
requireText('apps/api/src/modules/payments/provider/stripe-checkout.provider.ts', [
  'stripeOperationBlockReason', 'tradenest-refund-', 'throw new ApiException(503',
]);
const stripe = get('apps/api/src/modules/payments/provider/stripe-checkout.provider.ts');
if (!stripe.includes("'/v1/refunds'")) errors.push('Durable refund adapter is missing Stripe refund operation.');
const refund = stripe.slice(stripe.indexOf('async refundPayment('), stripe.indexOf('verifyWebhook('));
if (!refund.includes("stripeOperationBlockReason(cfg.PAYMENT_STRIPE_SECRET_KEY, 'refund')") || !refund.includes('input.reconcileOnly')) errors.push('Stripe refund guard/reconciliation must fail closed.');
if (!get('apps/api/src/modules/orders/order-expiration.service.ts').includes('if (payment.externalPending) return')) errors.push('Unsafe recovery: provider-pending inventory may be released.');
if (!get('SPEC_LOCK.yaml').includes('"modular monolith"')) errors.push('Architecture lock not found.');
if (!existsSync(resolve(root,'pnpm-lock.yaml'))) {
  console.log('REMAINING BLOCKER: pnpm-lock.yaml missing. Generate under Node 24 / pnpm 10.15.1 with a reachable registry.');
}
if (errors.length) {
  console.error('FINANCIAL REMEDIATION STATIC REMEDIATION: FAILED');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('FINANCIAL REMEDIATION STATIC REMEDIATION: PASSED with Financial reconciliation forward-compatible durable refund checks (not live payment certification).');
}
