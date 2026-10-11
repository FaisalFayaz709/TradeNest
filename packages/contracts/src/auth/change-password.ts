import { z } from 'zod';

const BCRYPT_MAX_PASSWORD_BYTES = 72;
const encoder = new TextEncoder();

export const ChangePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1)
    .max(1024)
    .refine((value) => encoder.encode(value).byteLength <= BCRYPT_MAX_PASSWORD_BYTES, {
      message: `Password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes for bcrypt.`,
    }),
  newPassword: z
    .string()
    .min(8)
    .refine((value) => encoder.encode(value).byteLength <= BCRYPT_MAX_PASSWORD_BYTES, {
      message: `Password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes for bcrypt.`,
    }),
});

export const ChangePasswordResultSchema = z.object({
  changed: z.literal(true),
  sessionsRevoked: z.number().int().nonnegative(),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ChangePasswordResult = z.infer<typeof ChangePasswordResultSchema>;
