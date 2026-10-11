import { z } from 'zod';

/** User roles are locked by the TradeNest blueprint. */
const UserRoleSchema = z.enum(['BUYER', 'SELLER', 'ADMIN']);

/** User account states are the values established by the database foundation. */
export const UserStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'BANNED']);

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(320),
  name: z.string().min(1).max(200),
  role: UserRoleSchema,
  status: UserStatusSchema,
  emailVerifiedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Blueprint endpoint: PATCH /users/me — Update profile.
 *
 * this contract surface intentionally limits the editable field set to name. Email changes
 * require verification/re-authentication policy that the blueprint does not
 * define, so this document does not silently invent that workflow.
 */
export const UpdateUserProfileSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const DeleteAccountResultSchema = z.object({
  deleted: z.literal(true),
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type UpdateUserProfileInput = z.infer<typeof UpdateUserProfileSchema>;
export type DeleteAccountResult = z.infer<typeof DeleteAccountResultSchema>;
