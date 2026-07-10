import { z } from "zod";

export const roleEnum = z.enum(["CUSTOMER", "ADMIN", "SUPER_ADMIN"]);

export const updateUserSchema = z
  .object({
    role: roleEnum.optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.isActive !== undefined, {
    message: "Πρέπει να δοθεί role ή isActive",
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const createUserSchema = z.object({
  email: z.string().email("Μη έγκυρο email"),
  firstName: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  lastName: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  phone: z.string().optional(),
  role: roleEnum.default("CUSTOMER"),
  // Optional: if omitted, the server generates a random temporary password
  // and returns it once in the response for the SUPER_ADMIN to relay.
  password: z.string().min(8, "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες").optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
