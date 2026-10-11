import { z } from 'zod';

export const UserRoleSchema = z.enum(['BUYER', 'SELLER', 'ADMIN']);

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: UserRoleSchema,
});

export const TokenPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  accessTokenExpiresIn: z.number().int().positive(),
  refreshTokenExpiresIn: z.number().int().positive(),
});

export const AuthSessionSchema = z.object({
  user: AuthUserSchema,
  tokens: TokenPairSchema,
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1).max(1024),
});

export const LogoutResultSchema = z.object({ revoked: z.boolean() });
export const LogoutAllResultSchema = z.object({ revokedSessions: z.number().int().nonnegative() });

export type AuthUser = z.infer<typeof AuthUserSchema>;
export type TokenPair = z.infer<typeof TokenPairSchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type RefreshInput = z.infer<typeof RefreshSchema>;
export type LogoutResult = z.infer<typeof LogoutResultSchema>;
export type LogoutAllResult = z.infer<typeof LogoutAllResultSchema>;
