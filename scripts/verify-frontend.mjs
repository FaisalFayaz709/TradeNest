/** Independent static guard: no dependencies or live API required. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const checks = [
  ['Product image proxy streams binary', 'apps/web/app/api/tradenest/[...path]/route.ts', /new NextResponse\(image\.body/],
  ['Protected notification proxy', 'apps/web/app/api/tradenest/[...path]/route.ts', /\^notifications\\\/unread-count\$/],
  ['Managed storage authorize routes', 'apps/web/app/api/tradenest/[...path]/route.ts', /images\\\/upload-url/],
  ['Frontend admin moderation proxy', 'apps/web/app/api/tradenest/[...path]/route.ts', /suspend\|reactivate/],
  ['Hosted Stripe navigation on checkout', 'apps/web/app/checkout/page.tsx', /hostedCheckoutRedirect/],
  ['Hosted Stripe navigation on order detail', 'apps/web/app/orders/[id]/order-detail-client.tsx', /hostedCheckoutRedirect/],
  ['Buyer-scoped payment shortcuts', 'apps/web/lib/api-client.ts', /RECENT_PAYMENT_KEY}:\$\{buyerId\}/],
  ['Responsive mobile menu semantics', 'apps/web/components/site-header.tsx', /aria-expanded=\{open\}/],
  ['Notification UI ownership integration', 'apps/web/app/notifications/page.tsx', /notifications\/\$\{id\}\/read/],
  ['S3 product image selector', 'apps/web/app/seller/products/page.tsx', /uploadManagedFile\('products'/],
  ['S3 dispute evidence selector', 'apps/web/app/orders/[id]/order-detail-client.tsx', /uploadManagedFile\('disputes'/],
  ['Seller analytics API integration', 'apps/web/app/seller/analytics/page.tsx', /seller\/analytics\/overview/],
  ['Admin reports backend read model', 'apps/web/app/admin/reports/page.tsx', /admin\/dashboard/],
];
for (const [label, file, pattern] of checks) {
  if (!pattern.test(read(file))) { console.error(`FRONTEND FAIL: ${label}`); process.exitCode = 1; }
  else console.log(`FRONTEND PASS: ${label}`);
}
if (!process.exitCode) console.log(`FRONTEND STATIC PASSED: ${checks.length}/${checks.length} frontend gates.`);
