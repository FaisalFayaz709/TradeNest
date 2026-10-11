import { z } from 'zod';

export const FraudRiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
export type FraudRiskLevel = z.infer<typeof FraudRiskLevelSchema>;

export const FraudReasonSchema = z.object({
  code: z.enum([
    'REPEATED_PAYMENT_FAILURES',
    'UNUSUALLY_HIGH_FIRST_ORDER',
    'ABNORMAL_TRANSACTION_FREQUENCY',
    'SESSION_IDENTITY_CHURN',
  ]),
  message: z.string().trim().min(1).max(240),
  contribution: z.number().finite().min(0).max(1),
}).strict();
export type FraudReason = z.infer<typeof FraudReasonSchema>;

export const FraudRiskScoreSchema = z.object({
  riskScore: z.number().finite().min(0).max(1),
  riskLevel: FraudRiskLevelSchema,
  reasons: z.array(FraudReasonSchema).max(8),
  reviewRecommended: z.boolean(),
  modelVersion: z.string().trim().min(1).max(128),
  generatedAt: z.string().datetime(),
}).strict();
export type FraudRiskScore = z.infer<typeof FraudRiskScoreSchema>;

export const FraudAlertQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  riskLevel: FraudRiskLevelSchema.optional(),
}).strict();
export type FraudAlertQuery = z.infer<typeof FraudAlertQuerySchema>;

export const FraudAlertSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  orderId: z.string().uuid().nullable(),
  paymentId: z.string().uuid().nullable(),
  riskScore: z.number().finite().min(0).max(1),
  riskLevel: FraudRiskLevelSchema,
  reasons: z.array(FraudReasonSchema).max(8),
  reviewRecommended: z.boolean(),
  modelVersion: z.string().trim().min(1).max(128),
  createdAt: z.string().datetime(),
}).strict();
export type FraudAlert = z.infer<typeof FraudAlertSchema>;

export const FraudAlertListSchema = z.object({
  items: z.array(FraudAlertSchema),
}).strict();
export type FraudAlertList = z.infer<typeof FraudAlertListSchema>;
