import { z } from 'zod';

/** Legacy registration route now accepts only backend-verified S3 keys; client URLs are ignored. */
export const AddProductImageSchema = z.object({
  objectKey: z.string().trim().min(1).max(1024),
  url: z.string().url().optional(),
  sortOrder: z.number().int().min(0).max(10_000).default(0),
  isPrimary: z.boolean().default(false),
});

export type AddProductImageInput = z.infer<typeof AddProductImageSchema>;

export const InitiateManagedUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});
export type InitiateManagedUploadInput = z.infer<typeof InitiateManagedUploadSchema>;
