import { z } from 'zod';

/**
 * The blueprint names seller_profiles.status and explicitly requires ACTIVE
 * sellers for product creation, but it does not define the complete status
 * vocabulary. Keep the transport contract open rather than inventing a
 * closed enum in this document.
 */
export const SellerStatusSchema = z.string().trim().min(1).max(32);

export const SellerStoreNameSchema = z.string().trim().min(1).max(200);

/**
 * this contract surface's minimal onboarding contract. The blueprint requires store_name and
 * slug on seller_profiles, but does not say that callers choose slugs. NestJS
 * therefore derives a stable slug server-side.
 */
export const OnboardSellerSchema = z.object({
  storeName: SellerStoreNameSchema,
});

export type OnboardSellerInput = z.infer<typeof OnboardSellerSchema>;

/**
 * The blueprint says PATCH /seller/profile updates the seller profile, but it
 * does not define mutable fields. This contract surface deliberately permits store-name
 * changes only. The stable slug is not silently rewritten.
 */
export const UpdateSellerProfileSchema = z.object({
  storeName: SellerStoreNameSchema,
});

export type UpdateSellerProfileInput = z.infer<typeof UpdateSellerProfileSchema>;

export const SellerProfileSchema = z.object({
  userId: z.string().uuid(),
  storeName: z.string(),
  slug: z.string(),
  status: SellerStatusSchema,
  rating: z.number().min(0).max(5).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SellerProfile = z.infer<typeof SellerProfileSchema>;

export const SellerDashboardSchema = z.object({
  profile: SellerProfileSchema,
});

export type SellerDashboard = z.infer<typeof SellerDashboardSchema>;
