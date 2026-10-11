import { z } from 'zod';

/** Human-supplied justification for sensitive administrative actions. */
export const ModerationReasonSchema = z.object({
  reason: z.string().trim().min(10).max(500),
}).strict();
export type ModerationReasonInput = z.infer<typeof ModerationReasonSchema>;
