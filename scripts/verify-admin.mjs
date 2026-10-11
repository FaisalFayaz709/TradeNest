/** Admin static guard: intentionally not a substitute for live NestJS/PostgreSQL tests. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = path => readFileSync(resolve(root, path), 'utf8');
const controller = read('apps/api/src/modules/admin/admin.controller.ts');
const admin = read('apps/api/src/modules/admin/admin.service.ts');
const users = read('apps/api/src/modules/users/users.service.ts');
const sellers = read('apps/api/src/modules/seller/seller.service.ts');
const catalog = read('apps/api/src/modules/catalog/catalog.service.ts');
const products = read('apps/api/src/modules/catalog/catalog.repository.ts');
const errors=[];
function check(name,pass){if(!pass)errors.push(name)}
for(const [area, id] of [['users','User'], ['sellers','Seller'], ['products','Product']]){
  for(const [action, serviceAction] of [['suspend', 'suspend'],['reactivate','reactivate']]){
    check(`POST /admin/${area}/:id/${action}`,controller.includes(`@Post('${area}/:id/${action}')`));
    check(`Controller service delegation ${area}/${action}`,new RegExp(`this\\.admin\\.${serviceAction}${id}\\(principal, id, body\\.reason\\)`).test(controller));
  }
}
check('Controller guarded with ADMIN + JWT',controller.includes("@RequireRoles('ADMIN')") && controller.includes('@UseGuards(AccessTokenGuard, RolesGuard)'));
check('Sensitive action rate limits',controller.match(/@RateLimit\('ADMIN_SENSITIVE_PRINCIPAL'\)/g)?.length >= 6);
check('All action bodies Zod-validated',controller.match(/@Body\(new ZodValidationPipe\(ModerationReasonSchema\)\)/g)?.length === 6);
check('All action path IDs validated',controller.match(/@Param\('id', new ZodValidationPipe\(UuidSchema\)\)/g)?.length === 6);
check('Admin uses inter-module API seams',!(/prisma|\.repository|\.client\./i.test(admin)));
for(const [subject,service] of [['user',users],['seller',sellers],['product',catalog]]){
 check(`${subject} serialized state mutation`,service.includes('runSerializable(async (transaction) =>'));
 check(`${subject} audit records`,service.includes('this.audit.write({') && service.includes('metadata: { reason }'));
 check(`${subject} guarded transitions`,service.includes('INVALID_STATE_TRANSITION'));
}
check('Self and admin-peer account protection',users.includes('ADMIN_SELF_MODERATION_FORBIDDEN') && users.includes('ADMIN_PEER_MODERATION_FORBIDDEN'));
check('Suspension revokes refresh/access sessions',users.includes('revokeUserSessions(targetId, transaction)'));
check('Seller activation requires active account',sellers.includes('this.auth.isAccountActive(sellerId, transaction)'));
check('Product reactivation requires active seller',catalog.includes("if (to === 'ACTIVE') await this.sellers.requireActiveSeller(before.sellerId, transaction)"));
check('Checkout gates seller eligibility',catalog.includes('await this.sellers.requireActiveSeller(product.sellerId, transaction)'));
check('Public listings exclude suspended sellers/accounts',products.includes('PUBLIC_SELLER_POLICY') && products.includes('...PUBLIC_SELLER_POLICY'));
check('Admin user UI actions',read('apps/web/app/admin/users/page.tsx').includes("moderateResource<UserProfile>"));
check('Admin seller UI actions',read('apps/web/app/admin/sellers/page.tsx').includes("moderateResource<AdminSellerSummary>"));
check('Admin product UI actions',read('apps/web/app/admin/products/page.tsx').includes("moderateResource<Product>"));
if(errors.length){console.error('ADMIN STATIC FAILED:',errors.join('; '));process.exitCode=1;}
else console.log('ADMIN STATIC PASSED: role guards, six command routes, validation, audit, ownership, policy and admin UI checked (source only).');
