import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiException } from '../http/api-exception.js';

// One private S3-compatible bucket. Images are served through a public, read-only
// NestJS media endpoint; evidence gets time-limited signed URLs only after policy checks.
export type UploadKind = 'products' | 'disputes';
const MIME: Record<string, { extension: string; kinds: UploadKind[]; maxBytes: number }> = {
  'image/jpeg': { extension: 'jpg', kinds: ['products', 'disputes'], maxBytes: 5 * 1024 * 1024 },
  'image/png': { extension: 'png', kinds: ['products', 'disputes'], maxBytes: 5 * 1024 * 1024 },
  'image/webp': { extension: 'webp', kinds: ['products', 'disputes'], maxBytes: 5 * 1024 * 1024 },
  'application/pdf': { extension: 'pdf', kinds: ['disputes'], maxBytes: 10 * 1024 * 1024 },
};
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export interface UploadRequest { fileName: string; mimeType: string; fileSize: number }

export function validateUpload(kind: UploadKind, input: UploadRequest): { extension: string; maxBytes: number } {
  const policy = MIME[input.mimeType];
  if (!policy || !policy.kinds.includes(kind) || !Number.isSafeInteger(input.fileSize) || input.fileSize < 1 || input.fileSize > policy.maxBytes) {
    throw new ApiException(400, { code: 'FILE_TYPE_OR_SIZE_INVALID', message: 'The file type or size is not allowed for this upload.' });
  }
  return policy;
}

export function validateObjectKey(kind: UploadKind, resourceId: string, actorId: string, key: string): void {
  const allowed = new RegExp(`^${kind}/${resourceId}/${actorId}/${UUID}\\.(jpg|png|webp|pdf)$`);
  if (!allowed.test(key) || (kind === 'products' && key.endsWith('.pdf'))) {
    throw new ApiException(403, { code: 'STORAGE_OBJECT_FORBIDDEN', message: 'The storage key is not scoped to this resource and uploader.' });
  }
}

function hasMagic(mime: string, bytes: Uint8Array): boolean {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v);
  if (mime === 'image/webp') return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (mime === 'application/pdf') return String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
  return false;
}

@Injectable()
export class StorageService {
  private client?: S3Client;
  private bucket?: string;
  private configured(): { client: S3Client; bucket: string } {
    const bucket = process.env.STORAGE_S3_BUCKET;
    const region = process.env.STORAGE_S3_REGION;
    if (!bucket || !region) {
      throw new ApiException(503, { code: 'STORAGE_NOT_CONFIGURED', message: 'S3-compatible storage has not been configured.' });
    }
    if (process.env.NODE_ENV === 'production' && process.env.STORAGE_S3_ENDPOINT?.startsWith('http://')) {
      throw new ApiException(503, { code: 'INSECURE_STORAGE_ENDPOINT', message: 'Production object storage must use TLS.' });
    }
    if (!this.client || this.bucket !== bucket) {
      this.client = new S3Client({
        region,
        requestChecksumCalculation: 'WHEN_REQUIRED',
        ...(process.env.STORAGE_S3_ENDPOINT ? { endpoint: process.env.STORAGE_S3_ENDPOINT, forcePathStyle: true } : {}),
        ...(process.env.STORAGE_S3_ACCESS_KEY_ID && process.env.STORAGE_S3_SECRET_ACCESS_KEY ? {
          credentials: { accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID, secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY },
        } : {}),
      });
      this.bucket = bucket;
    }
    return { client: this.client, bucket };
  }

  async initiate(kind: UploadKind, resourceId: string, actorId: string, request: UploadRequest) {
    const policy = validateUpload(kind, request);
    const { client, bucket } = this.configured();
    const objectKey = `${kind}/${resourceId}/${actorId}/${randomUUID()}.${policy.extension}`;
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: bucket, Key: objectKey, ContentType: request.mimeType,
    }), { expiresIn: 300 });
    return { uploadUrl, objectKey, headers: { 'Content-Type': request.mimeType }, expiresInSeconds: 300 };
  }

  async verify(kind: UploadKind, resourceId: string, actorId: string, objectKey: string): Promise<{ mimeType: string; size: number }> {
    validateObjectKey(kind, resourceId, actorId, objectKey);
    const { client, bucket } = this.configured();
    let head;
    try { head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey })); }
    catch { throw new ApiException(400, { code: 'STORAGE_OBJECT_NOT_FOUND', message: 'Upload the file before registering it.' }); }
    const mime = head.ContentType ?? '';
    const size = head.ContentLength ?? 0;
    validateUpload(kind, { fileName: objectKey, mimeType: mime, fileSize: size });
    if (!objectKey.endsWith(`.${MIME[mime]!.extension}`)) {
      throw new ApiException(400, { code: 'FILE_CONTENT_INVALID', message: 'Object extension and content type do not match.' });
    }
    if (!head.LastModified || Date.now() - head.LastModified.getTime() > 30 * 60 * 1000 || head.LastModified.getTime() > Date.now() + 60_000) {
      throw new ApiException(409, { code: 'UPLOAD_EXPIRED', message: 'Upload registration expired; please upload again.' });
    }
    try {
      const sample = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey, Range: 'bytes=0-15' }));
      const bytes = await sample.Body?.transformToByteArray();
      if (!bytes || !hasMagic(mime, bytes)) throw new Error('Unexpected file content');
    } catch {
      throw new ApiException(400, { code: 'FILE_CONTENT_INVALID', message: 'File content does not match the allowed format.' });
    }
    return { mimeType: mime, size };
  }

  async readPublicProductImage(objectKey: string): Promise<{ bytes: Uint8Array; mimeType: string }> {
    if (!objectKey.startsWith('products/')) throw new ApiException(404, { code: 'IMAGE_NOT_FOUND', message: 'Image not found.' });
    const { client, bucket } = this.configured();
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }));
    const mimeType = result.ContentType ?? '';
    if (!(mimeType in MIME) || !MIME[mimeType]!.kinds.includes('products') || !result.ContentLength || result.ContentLength > 5 * 1024 * 1024) {
      throw new ApiException(404, { code: 'IMAGE_NOT_FOUND', message: 'Image not found.' });
    }
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes || bytes.length > 5 * 1024 * 1024 || !hasMagic(mimeType, bytes)) {
      throw new ApiException(404, { code: 'IMAGE_NOT_FOUND', message: 'Image not found.' });
    }
    return { bytes, mimeType };
  }

  async signPrivateEvidence(objectKey: string): Promise<string> {
    if (!objectKey.startsWith('disputes/')) throw new ApiException(404, { code: 'EVIDENCE_NOT_FOUND', message: 'Evidence not found.' });
    const { client, bucket } = this.configured();
    return getSignedUrl(client, new GetObjectCommand({
      Bucket: bucket, Key: objectKey,
      ResponseContentDisposition: 'attachment',
      ResponseContentType: 'application/octet-stream',
    }), { expiresIn: 120 });
  }
}
