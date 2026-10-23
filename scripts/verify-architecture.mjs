import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (r) => join(root, r);
const read = (r) => readFileSync(p(r), 'utf8');
const failures = [];
const notes = [];
const principles = Array.from({length: 11}, (_, i) => ({ id: i + 1, failures: [] }));
const fail = (id, msg) => { failures.push(`P${id}: ${msg}`); principles[id-1].failures.push(msg); };
const requireFile = (r) => { if (!existsSync(p(r))) failures.push(`Missing architecture verification input: ${r}`); };
const sha = (r) => createHash('sha256').update(readFileSync(p(r))).digest('hex');
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]);
}
function textHas(file, ...markers) {
  const s = read(file);
  for (const marker of markers) if (!s.includes(marker)) failures.push(`${file}: missing required marker ${marker}`);
}

for (const f of [
  'source/TradeNest_Technical_Blueprint.pdf','SPEC_LOCK.yaml','package.json','apps/api/package.json','apps/web/package.json',
  'packages/contracts/package.json','apps/api/prisma/schema.prisma','apps/api/src/modules/orders/checkout.service.ts',
  'apps/api/src/modules/payments/payments.service.ts','apps/api/src/modules/escrow/escrow-commands.service.ts',
  'apps/api/src/modules/disputes/disputes.service.ts','apps/web/lib/api-client.ts','services/ai/app/main.py',
  'docker-compose.deploy.yml','docs/deployment-release-gate.md'
]) requireFile(f);

if (!failures.length) {
  if (sha('source/TradeNest_Technical_Blueprint.pdf') !== '5d452569aa8f91985212750523898a9864fff408c7e18c813a76409a6d5a51ef') failures.push('Authoritative blueprint checksum changed.');

  // Locked stack.
  const rootPkg = JSON.parse(read('package.json'));
  const apiPkg = JSON.parse(read('apps/api/package.json'));
  const webPkg = JSON.parse(read('apps/web/package.json'));
  const contractsPkg = JSON.parse(read('packages/contracts/package.json'));
  if (rootPkg.engines?.node !== '>=24.0.0 <25') failures.push('Locked Node.js 24 range changed.');
  if (rootPkg.packageManager !== 'pnpm@10.15.1') failures.push('Locked pnpm version changed.');
  for (const [dep, prefix] of [['@nestjs/common','^12.'],['@prisma/client','^7.']]) if (!String(apiPkg.dependencies?.[dep] ?? '').startsWith(prefix)) failures.push(`Locked API dependency ${dep} no longer targets ${prefix}`);
  if (!String(webPkg.dependencies?.next ?? '').startsWith('^16.')) failures.push('Next.js is no longer locked to major 16.');
  if (!String(webPkg.dependencies?.react ?? '').startsWith('^19.')) failures.push('React dependency missing from the Next.js 16 frontend.');
  if (!String(contractsPkg.dependencies?.zod ?? '').startsWith('^4.')) failures.push('Shared contracts are no longer Zod 4.');
  textHas('services/ai/pyproject.toml','fastapi>=','scikit-learn>=','pandas>=','numpy>=');
  textHas('docker-compose.deploy.yml','image: postgres:18');

  const apiFiles = walk(p('apps/api/src')).filter(f => f.endsWith('.ts'));
  const controllerFiles = apiFiles.filter(f => f.endsWith('.controller.ts'));
  const webFiles = [...walk(p('apps/web/app')), ...walk(p('apps/web/lib')), ...walk(p('apps/web/components'))]
    .filter(f => /\.(?:ts|tsx|js|jsx)$/.test(f))
    .filter(f => !f.includes(`${sep}__e2e${sep}`));
  const webText = webFiles.map(f => readFileSync(f,'utf8')).join('\n');

  // P1: frontend UX only.
  for (const [label,re] of [
    ['database persistence',/@prisma\/client|PrismaClient|DATABASE_URL/],
    ['direct AI service access',/AI_SERVICE_URL|localhost:8000|127\.0\.0\.1:8000|\/internal\/(?:recommendations|pricing|fraud)/],
    ['provider webhook authority',/payments\/webhooks/],
  ]) if (re.test(webText)) fail(1,`runtime web source contains ${label}`);

  // P2: provider-verified payment success.
  const payments = read('apps/api/src/modules/payments/payments.service.ts');
  const verifyPos = payments.indexOf('provider.verifyWebhook({ rawBody, headers })');
  const successPos = payments.indexOf("if (event.type === 'PAYMENT_SUCCEEDED')");
  const markPos = payments.indexOf('await this.repository.markSucceeded(');
  if (!(verifyPos >= 0 && verifyPos < successPos && successPos < markPos)) fail(2,'PAYMENT_SUCCEEDED transition is not downstream of provider verification.');
  for (const f of controllerFiles) {
    const s=readFileSync(f,'utf8');
    if (/@(?:Post|Patch)\([^\n]*(?:mark-paid|payment-success|succeeded)/i.test(s)) fail(2,`client-driven payment success route in ${relative(root,f)}`);
  }

  // P3: backend-authoritative prices/totals.
  const checkoutContract = read('packages/contracts/src/checkout/create-checkout.ts');
  const block = checkoutContract.match(/CreateCheckoutSchema\s*=\s*z\.object\(\{([\s\S]*?)\}\)\.strict\(\)/)?.[1] ?? '';
  if (/price|subtotal|shippingAmount|discountAmount|totalAmount|currency|sellerId|productId/i.test(block)) fail(3,'checkout input accepts authoritative price/total/catalog fields.');
  const checkout = read('apps/api/src/modules/orders/checkout.service.ts');
  for (const m of ['checkoutProductSnapshot','requireSingleSeller','parseMoney(product.unitPrice)','calculateTotals(subtotalMinor, currency)','reserveInventory']) if (!checkout.includes(m)) fail(3,`checkout authoritative marker missing: ${m}`);

  // P4: separate state machines.
  const schema = read('apps/api/prisma/schema.prisma');
  for (const e of ['OrderStatus','PaymentStatus','EscrowStatus']) if (!new RegExp(`enum\\s+${e}\\s*\\{`).test(schema)) fail(4,`${e} missing`);
  for (const m of ['orders','payments','escrow']) if (!existsSync(p(`apps/api/src/modules/${m}`))) fail(4,`${m} module missing`);

  // P5: financial transitions transactional/idempotent/audited.
  for (const [file, markers] of [
    ['apps/api/src/modules/orders/checkout.service.ts',['runSerializable','idempotency']],
    ['apps/api/src/modules/payments/payments.service.ts',['runSerializable','idempotency']],
    ['apps/api/src/modules/escrow/escrow-commands.service.ts',['runSerializable','idempotency','audit.write']],
    ['apps/api/src/modules/disputes/disputes.service.ts',['runSerializable','audit.write']],
  ]) { const s=read(file); for (const m of markers) if (!s.includes(m)) fail(5,`${file} missing ${m}`); }

  // P6: Zod + service rules + PostgreSQL integrity.
  textHas('apps/api/src/common/http/zod-validation.pipe.ts','safeParse');
  textHas('apps/web/lib/api-client.ts','@tradenest/contracts/common','ApiSuccessEnvelopeSchema.parse','StandardErrorSchema.parse');
  if (!/providerPaymentId\s+String\s+@unique/.test(schema)) fail(6,'provider payment ID uniqueness is missing from Prisma schema.');
  if (!/orderItemId\s+String\s+@unique/.test(schema)) fail(6,'one-review-per-order-item uniqueness is missing from Prisma schema.');
  if (!/availableQuantity\s+Int/.test(schema) || !/reservedQuantity\s+Int/.test(schema)) fail(6,'inventory quantity fields are missing from Prisma schema.');
  const foundationMigration = read('apps/api/prisma/migrations/202610050001_database_foundation/migration.sql');
  for (const marker of ['inventory_available_nonnegative_check','inventory_reserved_nonnegative_check']) if (!foundationMigration.includes(marker)) fail(6,`database inventory constraint missing: ${marker}`);

  // P7: RBAC + ownership/policy.
  const controllers = controllerFiles.map(f=>readFileSync(f,'utf8')).join('\n');
  if (!controllers.includes('RolesGuard')) fail(7,'RolesGuard is not used by controllers.');
  const serviceText = apiFiles.filter(f=>f.endsWith('.service.ts')).map(f=>readFileSync(f,'utf8')).join('\n');
  if (!/owner|ownership|assert.*Access|assert.*Seller|assert.*Buyer|participant/i.test(serviceText)) fail(7,'ownership/policy enforcement markers not found in services.');

  // P8: module seams and repository ownership.
  for (const f of controllerFiles) if (/PrismaService|@prisma\/client/.test(readFileSync(f,'utf8'))) fail(8,`controller accesses Prisma: ${relative(root,f)}`);
  const moduleRoot=p('apps/api/src/modules');
  for (const [modDir] of readdirSync(moduleRoot,{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>[e.name])) {
    for (const f of walk(join(moduleRoot,modDir)).filter(x=>x.endsWith('.ts'))) {
      const s=readFileSync(f,'utf8');
      for (const m of s.matchAll(/from\s+['\"]([^'\"]+)['\"]/g)) {
        const imp=m[1];
        if (imp.includes('../') && /(?:repository|\.repository)/.test(imp) && !imp.includes('/public/')) fail(8,`possible cross-module repository import: ${relative(root,f)} -> ${imp}`);
      }
    }
  }

  // P9: Prisma types are not public contracts.
  for (const f of walk(p('packages/contracts/src')).filter(x=>x.endsWith('.ts'))) if (/@prisma\/client|Prisma\./.test(readFileSync(f,'utf8'))) fail(9,`Prisma leaked into shared contract ${relative(root,f)}`);

  // P10: AI internal/advisory only.
  const aiPy = walk(p('services/ai')).filter(f=>f.endsWith('.py')).map(f=>readFileSync(f,'utf8')).join('\n');
  if (/sqlalchemy|psycopg|asyncpg|DATABASE_URL|Prisma/i.test(aiPy)) fail(10,'AI service contains marketplace persistence access.');
  if (!read('apps/api/src/modules/ai-bridge/pricing.controller.ts').includes("@Post('seller/products/:id/price-suggestion')")) fail(10,'canonical advisory seller price-suggestion route missing.');
  if (/update.*price|set.*price|prisma/i.test(read('services/ai/app/pricing.py'))) fail(10,'AI pricing implementation appears to mutate marketplace price state.');

  // P11: one NestJS modular monolith; FastAPI only AI.
  const allTs = apiFiles.map(f=>readFileSync(f,'utf8')).join('\n');
  if (/@nestjs\/microservices|Transport\.|ClientProxy|MessagePattern/.test(allTs)) fail(11,'NestJS microservice transport detected.');
  const compose=read('docker-compose.deploy.yml');
  if (/kafka|rabbitmq|nats:/i.test(compose)) fail(11,'marketplace message-broker microservice topology detected.');
  if (!compose.includes('dockerfile: infrastructure/docker/api.Dockerfile')) fail(11,'single NestJS API deployable missing from deployment topology.');

  // Architecture hardening closure checks.
  textHas('apps/api/src/modules/analytics/seller-analytics.controller.ts',"@Get('overview')","@Get('revenue')");
  textHas('apps/api/src/modules/ai-bridge/pricing.controller.ts',"@Post('seller/products/:id/price-suggestion')","@Get('seller/ai-insights')");
  textHas('apps/api/src/modules/orders/checkout.controller.ts',"@RateLimit('CHECKOUT_PRINCIPAL')");
  textHas('apps/api/src/modules/disputes/disputes.controller.ts',"@RateLimit('ADMIN_SENSITIVE_PRINCIPAL')");
  // UI copy may change. Verify payment creation still goes through an authenticated
  // backend POST, and successful payment is established by the sandbox provider
  // webhook—not by a browser-controlled success state.
  textHas('apps/web/e2e/commerce-workflows.spec.ts',
    'orders/${checkoutPayload.data.order.id}/payments',
    "response.request().method() === 'POST'",
    'expect(createdPayment.ok()).toBeTruthy()',
    'await succeedSandboxPayment(completedPurchase.payment)',
    'Confirm delivery', 'Open dispute', 'Refund buyer', 'Release to seller');
  textHas('apps/api/src/common/observability/http-observability.interceptor.ts','recordHttpRequest','requestId');
  textHas('infrastructure/docker/api.Dockerfile','node:24-bookworm-slim','pnpm install --frozen-lockfile');
  textHas('infrastructure/docker/web.Dockerfile','node:24-bookworm-slim','pnpm install --frozen-lockfile');
  textHas('infrastructure/docker/ai.Dockerfile','python:3.13-slim');

  // Release truthfulness: open decisions/blockers must remain explicit.
  const gate=read('docs/deployment-release-gate.md');
  for (const marker of ['pnpm-lock.yaml','Production payment gateway','Object storage provider','S3-compatible','Cloudinary']) if (!gate.includes(marker)) failures.push(`Deployment release gate no longer documents: ${marker}`);
  if (!existsSync(p('pnpm-lock.yaml'))) notes.push('pnpm-lock.yaml absent: locked-runtime dependency resolution/acceptance remains required.');
  if (!/PAYMENT_PROVIDER:\s*\$\{PAYMENT_PROVIDER:-sandbox\}/.test(compose)) notes.push('Reference deployment payment provider is not the sandbox default expected by the audited source.');
  notes.push('Production payment gateway and object-storage provider remain blueprint-permitted implementation decisions and must be selected before production release.');
  notes.push('Live Node.js 24 + pnpm 10.15.1 + PostgreSQL 18 + Docker/Jest/Playwright acceptance is external to this source-only runner.');

  // Release archives must not retain generated caches.
  const generated = walk(root).filter(f => f.includes(`${sep}__pycache__${sep}`) || f.includes(`${sep}.pytest_cache${sep}`) || f.endsWith('.pyc'));
  if (generated.length) failures.push(`Generated Python/test cache artifacts present: ${generated.slice(0,8).map(f=>relative(root,f)).join(', ')}`);
}

if (failures.length) {
  console.error('ARCHITECTURE VERIFICATION FAILED');
  for (const x of failures) console.error(`- ${x}`);
  process.exit(1);
}
console.log('ARCHITECTURE VERIFICATION SUCCEEDED');
for (const pr of principles) console.log(`P${pr.id}: OK`);
console.log('Locked stack, hardening controls, deployment topology, and all eleven non-negotiable architecture principles are source-conformant.');
console.log('PRODUCTION RELEASE STATUS: BLOCKED/PENDING EXTERNAL ACCEPTANCE');
for (const n of notes) console.log(`- ${n}`);
