/** Fail-closed source review: Storage is NOT runtime approval. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const checks = [
  ['S3-compatible SDK and bounded private uploads', 'apps/api/src/common/storage/storage.service.ts', /PutObjectCommand[\s\S]*getSignedUrl|new PutObjectCommand/],
  ['Uploader-and-resource scoped object key', 'apps/api/src/common/storage/storage.service.ts', /validateObjectKey\(kind, resourceId, actorId, objectKey\)/],
  ['Uploaded object existence check', 'apps/api/src/common/storage/storage.service.ts', /new HeadObjectCommand/],
  ['No executable SVG, HTML or other unapproved MIME', 'apps/api/src/common/storage/storage.service.ts', /hasMagic\(mime, bytes\)/],
  ['Strict product image registration', 'apps/api/src/modules/catalog/catalog.service.ts', /this\.storage\.verify\('products', id, principal\.userId, input\.objectKey\)/],
  ['Product owner required before presigning', 'apps/api/src/modules/catalog/catalog.service.ts', /prepareImageUpload[\s\S]*requireOwnedProduct\(principal, id, false\)/],
  ['Canonical product image URL constructed by backend', 'apps/api/src/modules/catalog/catalog.repository.ts', /url: `\/api\/tradenest\/products\/\$\{productId\}\/images\/\$\{created\.id\}\/file`/],
  ['Public image restricted to active product AND seller/account', 'apps/api/src/modules/catalog/catalog.repository.ts', /where: \{ id: imageId, productId, product: \{ status: 'ACTIVE', \.\.\.PUBLIC_SELLER_POLICY \} \}/],
  ['Private evidence ownership and status checks', 'apps/api/src/modules/disputes/disputes.service.ts', /prepareEvidenceUpload[\s\S]*requireParticipantOrAdmin\(principal, dispute\)[\s\S]*dispute\.status !== 'OPEN'/],
  ['Private evidence file verification', 'apps/api/src/modules/disputes/disputes.service.ts', /this\.storage\.verify\('disputes', disputeId, principal\.userId, input\.objectKey\)/],
  ['Evidence signed only after get authorization', 'apps/api/src/modules/disputes/disputes.service.ts', /this\.requireParticipantOrAdmin\(principal, row\);[\s\S]*this\.storage\.signPrivateEvidence/],
  ['Evidence served as short-lived attachment', 'apps/api/src/common/storage/storage.service.ts', /ResponseContentDisposition: 'attachment'[\s\S]*expiresIn: 120/],
  ['Buyer UI actually performs file upload', 'apps/web/app/orders/[id]/order-detail-client.tsx', /uploadManagedFile\('disputes', dispute\.id, file\)/],
  ['Seller dispute UI actually performs file upload', 'apps/web/app/seller/disputes/[id]/seller-dispute-detail-client.tsx', /uploadManagedFile\('disputes', id, file\)/],
  ['Seller product UI actually performs file upload', 'apps/web/app/seller/products/page.tsx', /uploadManagedFile\('products', product\.id, imageFile\)/],
  ['Binary response forwarded by Next proxy', 'apps/web/app/api/tradenest/[...path]/route.ts', /new NextResponse\(image\.body[\s\S]*X-Content-Type-Options': 'nosniff'/],
  ['Product response contracts allow backend-generated same-origin URLs', 'packages/contracts/src/products/product.ts', /z\.string\(\)\.regex\(\/\^\\\/api/],
  ['Unique product image object keys', 'apps/api/prisma/migrations/202610080005_managed_upload_object_uniqueness/migration.sql', /UNIQUE INDEX "product_images_object_key_key"/],
  ['Unique private evidence object keys', 'apps/api/prisma/migrations/202610080005_managed_upload_object_uniqueness/migration.sql', /UNIQUE INDEX "dispute_evidence_object_key_key"/],
];
const missing = checks.filter(([name, path, matcher]) => !matcher.test(read(path))).map(([name]) => name);
if (missing.length) {
  console.error(`STORAGE SOURCE CHECK FAILED: ${missing.join('; ')}`);
  process.exit(1);
}
console.log(`STORAGE SOURCE CHECK PASSED: ${checks.length} security/integration invariants found.`);
console.log('This does not prove a successful S3 upload or an HTTP/database integration test.');
