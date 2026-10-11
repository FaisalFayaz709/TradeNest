import { z } from 'zod';

export const DisputeStatusSchema = z.enum(['OPEN', 'RESOLVED']);
export const DisputeResolutionSchema = z.enum(['REFUND_BUYER', 'RELEASE_TO_SELLER']);

export const OpenDisputeSchema = z.object({
  reason: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(5000),
});

export const AddDisputeMessageSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export const AddDisputeEvidenceSchema = z.object({
  objectKey: z.string().trim().min(1).max(1024),
  url: z.string().trim().url().max(4096).optional(),
  fileName: z.string().trim().min(1).max(255).optional(),
  mimeType: z.string().trim().min(1).max(120).optional(),
});

export const ResolveDisputeSchema = z.object({
  resolution: DisputeResolutionSchema,
});

export const DisputeMessageSchema = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  authorId: z.string().uuid(),
  body: z.string(),
  createdAt: z.string().datetime(),
});

export const DisputeEvidenceSchema = z.object({
  id: z.string().uuid(),
  disputeId: z.string().uuid(),
  uploadedById: z.string().uuid(),
  objectKey: z.string(),
  url: z.string(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const DisputeSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  buyerId: z.string().uuid(),
  sellerId: z.string().uuid(),
  reason: z.string(),
  description: z.string(),
  status: DisputeStatusSchema,
  resolution: DisputeResolutionSchema.nullable(),
  resolvedBy: z.string().uuid().nullable(),
  openedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  messages: z.array(DisputeMessageSchema),
  evidence: z.array(DisputeEvidenceSchema),
});

export type OpenDisputeInput = z.infer<typeof OpenDisputeSchema>;
export type AddDisputeMessageInput = z.infer<typeof AddDisputeMessageSchema>;
export type AddDisputeEvidenceInput = z.infer<typeof AddDisputeEvidenceSchema>;
export type ResolveDisputeInput = z.infer<typeof ResolveDisputeSchema>;
export type Dispute = z.infer<typeof DisputeSchema>;
export type DisputeMessage = z.infer<typeof DisputeMessageSchema>;
export type DisputeEvidence = z.infer<typeof DisputeEvidenceSchema>;
export type DisputeResolution = z.infer<typeof DisputeResolutionSchema>;
