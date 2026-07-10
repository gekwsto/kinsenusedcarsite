import { z } from "zod";

export const createFaqSchema = z.object({
  question: z.string().min(1, "Η ερώτηση είναι υποχρεωτική"),
  answer: z.string().min(1, "Η απάντηση είναι υποχρεωτική"),
  category: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateFaqSchema = z.object({
  question: z.string().min(1).optional(),
  answer: z.string().min(1).optional(),
  category: z.string().optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
  isActive: z.coerce.boolean().optional(),
});

export type CreateFaqInput = z.infer<typeof createFaqSchema>;
export type UpdateFaqInput = z.infer<typeof updateFaqSchema>;
