import { jsonData } from './api-client';

export interface ManagedUpload {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresInSeconds: number;
}

/** Browser uploads directly to private S3 via a 5-minute scoped presigned PUT. */
export async function uploadManagedFile(kind: 'products' | 'disputes', resourceId: string, file: File): Promise<string> {
  const endpoint = kind === 'products' ? `products/${resourceId}/images/upload-url` : `disputes/${resourceId}/evidence/upload-url`;
  const prepared = await jsonData<ManagedUpload>(endpoint, 'POST', {
    fileName: file.name, mimeType: file.type, fileSize: file.size,
  });
  const uploaded = await fetch(prepared.uploadUrl, {
    method: 'PUT', body: file, headers: prepared.headers,
  });
  if (!uploaded.ok) {
    throw new Error('File upload failed. Check the storage service and allowed CORS origins, then retry.');
  }
  return prepared.objectKey;
}
