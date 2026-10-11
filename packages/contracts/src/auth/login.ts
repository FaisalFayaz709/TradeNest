import { z } from 'zod';

const BCRYPT_MAX_PASSWORD_BYTES = 72;
const encoder = new TextEncoder();

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z
    .string()
    .min(1)
    .max(1024)
    .refine((value) => encoder.encode(value).byteLength <= BCRYPT_MAX_PASSWORD_BYTES, {
      message: `Password must be at most ${BCRYPT_MAX_PASSWORD_BYTES} UTF-8 bytes for bcrypt.`,
    }),
});

export type LoginInput = z.infer<typeof LoginSchema>;
