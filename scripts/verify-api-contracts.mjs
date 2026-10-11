/**
 * Dependency-free static gate for the 74 distinct blueprint §5 API operations.
 * This catches missing/extra route declarations, unauthenticated sensitive routes,
 * missing role decorators, absent validation at mutation boundaries, and Swagger
 * bearer documentation drift. It DOES NOT prove handlers or ownership at runtime.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const apiRoot = join(root, 'apps/api/src/modules');
const spec = JSON.parse(readFileSync(join(root, 'scripts/blueprint-endpoints.json'), 'utf8'));
const failures = [];
const fail = (msg) => failures.push(msg);
const clean = (path) => ('/' + String(path || '').replace(/^\/+|\/+$/g, '')).replace(/\/{2,}/g, '/');
const pathComparable = (path) => clean(path).replace(/:[A-Za-z][A-Za-z\d]*/g, ':parameter');
const sig = (entry) => `${entry.method} ${pathComparable(entry.path)}`;
const unique = new Map();
function walk(directory) {
  return readdirSync(directory, { withFileTypes:true }).flatMap((e) =>
    e.isDirectory() ? walk(join(directory,e.name)) : e.name.endsWith('.controller.ts') ? [join(directory,e.name)] : []);
}
for (const file of walk(apiRoot)) {
  const s = readFileSync(file,'utf8');
  const c = s.match(/@Controller\((?:'([^']*)'|"([^"]*)")?\)([\s\S]*?)export class \w+/);
  if (!c) { fail(`Malformed controller ${relative(root,file)}`); continue; }
  const base = c[1] ?? c[2] ?? '';
  const classMeta = c[3];
  const classRoles = [...classMeta.matchAll(/@RequireRoles\(([^)]*)\)/g)].at(-1)?.[1] ?? '';
  const classGuards = [...classMeta.matchAll(/@UseGuards\(([^)]*)\)/g)].at(-1)?.[1] ?? '';
  const classSwagger = /@ApiBearerAuth\(\)/.test(classMeta);
  const source = s.slice(c.index + c[0].length);
  const rex = /^\s+@(Get|Post|Patch|Delete|Put)\((?:'([^']*)'|"([^"]*)")?\)/gm;
  const decs = [...source.matchAll(rex)];
  for (let i = 0; i < decs.length; i++) {
    const m = decs[i];
    const next = decs[i+1]?.index ?? source.length;
    const block = source.slice(m.index, next);
    const method = m[1].toUpperCase();
    const path = clean([base,m[2] ?? m[3] ?? ''].filter(Boolean).join('/'));
    const key = sig({method,path});
    const routeRoles = [...block.matchAll(/@RequireRoles\(([^)]*)\)/g)].at(0)?.[1] ?? classRoles;
    const routeGuards = [...block.matchAll(/@UseGuards\(([^)]*)\)/g)].map(x=>x[1]).join(',');
    const guards = `${classGuards},${routeGuards}`;
    const swagger = classSwagger || /@ApiBearerAuth\(\)/.test(block);
    const hasBearer = /\bAccessTokenGuard\b/.test(guards);
    const hasOptional = /\bOptionalAccessTokenGuard\b/.test(guards);
    const hasRolesGuard = /\bRolesGuard\b/.test(guards);
    const roles = [...routeRoles.matchAll(/'(BUYER|SELLER|ADMIN)'/g)].map(x=>x[1]);
    const local = relative(root,file);
    if (unique.has(key)) fail(`Duplicate registered operation ${key}: ${local} and ${unique.get(key).file}`);
    unique.set(key,{ method, path, guards, roles, hasBearer, hasOptional, hasRolesGuard, swagger, file: local, block });
    // Validate all dynamic path arguments except no implicit name assumptions.
    for (const param of path.matchAll(/:([A-Za-z][A-Za-z\d]*)/g)) {
      if (!block.includes(`@Param('${param[1]}', new ZodValidationPipe(`)) {
        fail(`${key}: ${local}: unvalidated route parameter :${param[1]}`);
      }
    }
    if (/@Body\(/.test(block) && !/@Body\(new ZodValidationPipe\(/.test(block)) {
      fail(`${key}: ${local}: request body has no Zod boundary validation`);
    }
    if (/@Query\(/.test(block) && !/@Query\(new ZodValidationPipe\(/.test(block)) {
      fail(`${key}: ${local}: query has no Zod boundary validation`);
    }
  }
}
if (spec.basePath !== '/api/v1') fail('Blueprint base path changed.');
if (spec.required.length !== 74) fail(`Expected exactly 74 blueprint signatures, got ${spec.required.length}.`);
const expected = new Map();
for (const entry of spec.required) {
  const key = sig(entry);
  if (expected.has(key)) fail(`Duplicate blueprint entry: ${key}`);
  expected.set(key,entry);
  const implementation = unique.get(key);
  if (!implementation) { fail(`Missing required blueprint operation: ${key}`); continue; }
  if (entry.access === 'PUBLIC' || entry.access === 'WEBHOOK') {
    if (implementation.hasBearer || implementation.swagger) fail(`${key}: public/provider endpoint should not require JWT bearer auth`);
  } else if (entry.access === 'OPTIONAL') {
    if (!implementation.hasOptional || implementation.hasBearer || implementation.swagger) fail(`${key}: optional-token event route must not require a JWT`);
  } else {
    if (!implementation.hasBearer) fail(`${key}: required AccessTokenGuard is missing`);
    if (!implementation.swagger) fail(`${key}: Swagger bearer metadata is missing`);
  }
  if (entry.roles.length) {
    if (!implementation.hasRolesGuard) fail(`${key}: required RolesGuard is missing`);
    const equal = JSON.stringify([...implementation.roles].sort()) === JSON.stringify([...entry.roles].sort());
    if (!equal) fail(`${key}: RBAC roles ${JSON.stringify(implementation.roles)} differ from expected ${JSON.stringify(entry.roles)}`);
  }
}
const extra = [...unique.keys()].filter(k => !expected.has(k));
// Approved, pre-existing extensions must not become a bypass around the blueprint.
const approvedExtras = new Map([
  ['POST /admin/users/:parameter/suspend',['ADMIN']],
  ['POST /admin/users/:parameter/reactivate',['ADMIN']],
  ['POST /admin/sellers/:parameter/suspend',['ADMIN']],
  ['POST /admin/sellers/:parameter/reactivate',['ADMIN']],
  ['POST /admin/products/:parameter/suspend',['ADMIN']],
  ['POST /admin/products/:parameter/reactivate',['ADMIN']],
  ['GET /admin/disputes',['ADMIN']],
  ['GET /admin/orders',['ADMIN']],
  ['GET /admin/products',['ADMIN']],
  ['GET /admin/sellers',['ADMIN']],
  ['GET /ai/pricing/products/:parameter',['SELLER']],
  ['GET /seller/disputes',['SELLER']],
  ['GET /notifications',['BUYER','SELLER','ADMIN']],
  ['GET /notifications/unread-count',['BUYER','SELLER','ADMIN']],
  ['PATCH /notifications/read-all',['BUYER','SELLER','ADMIN']],
  ['PATCH /notifications/:parameter/read',['BUYER','SELLER','ADMIN']],
  ['POST /products/:parameter/images/upload-url',['SELLER']],
  ['POST /disputes/:parameter/evidence/upload-url',['BUYER','SELLER']],
]);
const approvedPublicExtras = new Set(['GET /products/:parameter/images/:parameter/file']);
for (const key of extra) {
  if (approvedPublicExtras.has(key)) {
    const operation = unique.get(key);
    if (operation.hasBearer || operation.swagger) fail(`Public media endpoint cannot require JWT: ${key}`);
    continue;
  }
  const approval = approvedExtras.get(key);
  const e = unique.get(key);
  if (!approval) { fail(`Unreviewed extra endpoint: ${key}`); continue; }
  if (!e.hasBearer || !e.hasRolesGuard || !e.swagger ||
      JSON.stringify([...e.roles].sort()) !== JSON.stringify([...approval].sort())) {
    fail(`Unprotected or incorrectly documented approved extension: ${key}`);
  }
}
for (const name of approvedExtras.keys()) if (!unique.has(name)) fail(`Approved extension route was removed unexpectedly: ${name}`);
const requiredFound = [...expected.keys()].filter(k=>unique.has(k));
if (failures.length) {
  console.error(`API CONTRACTS STATIC FAILED (${failures.length} issue(s))`);
  failures.forEach(x => console.error('  - '+x));
  process.exitCode=1;
} else {
  console.log(`API CONTRACTS STATIC PASSED: ${requiredFound.length}/74 blueprint routes; ${extra.length} extension endpoints; ${unique.size} unique controller operations.`);
  console.log('Route shape, explicit guards, role declarations, Zod boundaries and Swagger bearer annotations checked.');
  console.log('Runtime functionality, ownership and executable Swagger output remain separate required gates.');
}
