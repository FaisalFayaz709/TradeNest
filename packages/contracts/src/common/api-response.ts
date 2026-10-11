import { z } from 'zod';

/**
 * API response contracts defined by TradeNest Technical Blueprint §5.
 * These schemas describe transport shape only. They do not encode domain rules.
 */
export const PaginationMetaSchema = z.object({
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const StandardErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()),
    requestId: z.string(),
  }),
});

export function successResponseSchema<TSchema extends z.ZodType>(data: TSchema) {
  return z.object({ data });
}

export function collectionResponseSchema<TSchema extends z.ZodType>(item: TSchema) {
  return z.object({
    data: z.array(item),
    meta: PaginationMetaSchema,
  });
}

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type StandardError = z.infer<typeof StandardErrorSchema>;


export const ApiDataEnvelopeSchema = z.object({ data: z.unknown() }).passthrough();
export const ApiCollectionEnvelopeSchema = z.object({ data: z.array(z.unknown()), meta: PaginationMetaSchema }).passthrough();
export const ApiSuccessEnvelopeSchema = z.union([ApiCollectionEnvelopeSchema, ApiDataEnvelopeSchema]);
