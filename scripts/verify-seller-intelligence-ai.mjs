/** Source-integrity gate, not a replacement for NestJS/PostgreSQL/Playwright. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const get = path => readFileSync(resolve(root,path), 'utf8');
const c = (name,path,pattern) => [name, existsSync(resolve(root,path)) && pattern.test(get(path))];
const checks = [
  c('verified-only purchase events','apps/api/src/modules/analytics/analytics.service.ts',/PURCHASE_EVENT_REQUIRES_VERIFIED_PAYMENT/),
  c('SQL-backed verified purchase projection','apps/api/src/modules/analytics/analytics.repository.ts',/JOIN LATERAL \([\s\S]*status = 'SUCCEEDED'/),
  c('recommendation output has honest fallback version','apps/api/src/modules/ai-bridge/recommendation-fallback.ts',/catalog-fallback-v1/),
  c('fallback only on AI dependency failures','apps/api/src/modules/ai-bridge/ai-bridge.service.ts',/private aiUnavailable\(error: unknown\)/),
  c('recommendation candidate stock filter','apps/api/src/modules/catalog/catalog.repository.ts',/inventory: \{ is: \{ availableQuantity: \{ gt: 0 \}/),
  c('buyer recommendation widget','apps/web/components/personalized-recommendations.tsx',/resolveActiveProducts/),
  c('seller pricing remains advisory','services/ai/app/pricing.py',/advisory=True/),
  c('fraud is only advisory','services/ai/app/fraud.py',/reviewRecommended=level == "HIGH"/),
  c('seller analytics currency separation','apps/api/src/modules/analytics/analytics.service.ts',/revenueByCurrency: revenue\.map/),
  c('internal AI remains separate Python','services/ai/app/main.py',/FastAPI\(/),
  c('frontend seller analytics proxy route','apps/web/app/api/tradenest/[...path]/route.ts',/seller\\\/analytics\(\?:\\\/\(\?:overview\|revenue\)\)\?/),
  c('seller insights import fixed','apps/web/app/seller/ai-insights/page.tsx',/apiData, jsonData/),
];
const failures = checks.filter(([,ok])=>!ok);
for(const [name,ok] of checks) console.log(`${ok?'OK':'FAIL'}: ${name}`);
if(failures.length){console.error(`${failures.length} Seller intelligence invariants failed`);process.exitCode=1;}
else console.log(`SELLER INTELLIGENCE SOURCE CHECK: ${checks.length}/${checks.length} passed; runtime acceptance pending.`);
