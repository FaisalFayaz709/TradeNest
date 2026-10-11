import { z } from 'zod';

const OptionalText = (max: number) => z.string().trim().min(1).max(max).optional();

/**
 * Address field shape follows this contract surface persistence decision for the
 * blueprint's "user-owned shipping addresses" requirement. These fields are
 * implementation decisions, not new locked product requirements.
 */
export const CreateAddressSchema = z.object({
  label: OptionalText(100),
  recipient: z.string().trim().min(1).max(200),
  line1: z.string().trim().min(1).max(255),
  line2: OptionalText(255),
  city: z.string().trim().min(1).max(120),
  region: OptionalText(120),
  postalCode: OptionalText(32),
  country: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  phone: OptionalText(40),
});

export const UpdateAddressSchema = CreateAddressSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'At least one address field must be provided.' },
);

export const AddressSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  label: z.string().nullable(),
  recipient: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().length(2),
  phone: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DeleteAddressResultSchema = z.object({
  deleted: z.literal(true),
});

export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type DeleteAddressResult = z.infer<typeof DeleteAddressResultSchema>;
