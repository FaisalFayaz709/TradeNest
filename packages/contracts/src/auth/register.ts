import { z } from 'zod';

const BCRYPT_MAX_PASSWORD_BYTES = 72;
const encoder = new TextEncoder();

export const PublicRegistrationRoleSchema = z.enum(['BUYER', 'SELLER']);

export const RegisterSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z
    .string()
    .min(8)
    .refine((value) => encoder.encode(value).byteLength <= BCRYPT_MAX_PASSWORD_BYTES, {
      message: `Password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes for bcrypt.`,
    }),
  role: PublicRegistrationRoleSchema.default('BUYER'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
