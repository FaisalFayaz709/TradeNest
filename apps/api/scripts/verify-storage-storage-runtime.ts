/** Integration smoke test for a dedicated NON-PRODUCTION S3-compatible bucket.
 * Requires STORAGE_S3_BUCKET ending -test and explicit local S3 endpoint.
 * Never uses a live production bucket or an unqualified shared bucket.
 */
import 'dotenv/config';
import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StorageService, validateObjectKey, validateUpload } from '../src/common/storage/index.js';

const bucket = process.env.STORAGE_S3_BUCKET || '';
const endpoint = process.env.STORAGE_S3_ENDPOINT || '';
if (process.env.NODE_ENV === 'production' || !bucket.endsWith('-test') || !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?$/.test(endpoint)) {
  throw new Error('STORAGE REFUSED: only a dedicated *-test bucket with a localhost S3 endpoint and non-production NODE_ENV may be used.');
}
const region = process.env.STORAGE_S3_REGION;
if (!region) throw new Error('STORAGE_S3_REGION is required.');
const store = new StorageService();
const client = new S3Client({ region, endpoint, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
  ...(process.env.STORAGE_S3_ACCESS_KEY_ID && process.env.STORAGE_S3_SECRET_ACCESS_KEY ? {
    credentials: { accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY },
  } : {}),
});
const resource = randomUUID(), owner = randomUUID(), outsider = randomUUID();
const keys: string[] = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WgPAAAAAElFTkSuQmCC', 'base64');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
async function upload(kind: 'products' | 'disputes', bytes: Buffer, mimeType: string) {
  const result = await store.initiate(kind, resource, owner, { fileName: 'fixture', mimeType, fileSize: bytes.length });
  keys.push(result.objectKey);
  const sent = await fetch(result.uploadUrl, { method: 'PUT', body: new Uint8Array(bytes), headers: result.headers });
  assert.equal(sent.status, 200, `S3 upload failed: ${sent.status} ${await sent.text()}`);
  const verified = await store.verify(kind, resource, owner, result.objectKey);
  assert.equal(verified.mimeType, mimeType);
  assert.equal(verified.size, bytes.length);
  assert.throws(() => validateObjectKey(kind, resource, outsider, result.objectKey));
  return result.objectKey;
}
try {
  assert.throws(() => validateUpload('products', { fileName: 'bad.pdf', mimeType: 'application/pdf', fileSize: 12 }));
  assert.throws(() => validateUpload('disputes', { fileName: 'bad.svg', mimeType: 'image/svg+xml', fileSize: 12 }));
  const imageKey = await upload('products', png, 'image/png');
  const image = await store.readPublicProductImage(imageKey);
  assert.equal(image.mimeType, 'image/png');
  assert.deepEqual(Buffer.from(image.bytes), png);
  const evidenceKey = await upload('disputes', pdf, 'application/pdf');
  const evidenceUrl = await store.signPrivateEvidence(evidenceKey);
  const received = await fetch(evidenceUrl);
  assert.equal(received.status, 200, `evidence GET failed ${received.status}`);
  assert.deepEqual(Buffer.from(await received.arrayBuffer()), pdf);
  console.log('STORAGE LIVE STORAGE PASSED: owner-scoped upload, S3 HEAD validation, image reads, private evidence download, disallowed formats.');
} finally {
  for (const key of keys) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
