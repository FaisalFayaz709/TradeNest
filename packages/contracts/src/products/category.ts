import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string(),
  slug: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(2).max(200),
  parentId: z.string().uuid().nullable().optional(),
});

export const UpdateCategorySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  parentId: z.string().uuid().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one category field must be provided.',
});

export type Category = z.infer<typeof CategorySchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
