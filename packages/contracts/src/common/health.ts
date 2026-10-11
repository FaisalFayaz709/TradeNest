import { z } from 'zod';

export const HealthStatusSchema = z.object({
  service: z.string().min(1),
  status: z.literal('ok'),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
