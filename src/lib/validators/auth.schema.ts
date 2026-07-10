import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z
  .object({
    firstName: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
    lastName: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
    email: z.string().email("Μη έγκυρο email"),
    phone: z.string().optional(),
    password: z.string().min(8, "Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες"),
    confirmPassword: z.string(),
    consent: z.literal(true, {
      errorMap: () => ({ message: "Πρέπει να αποδεχτείτε την πολιτική απορρήτου" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Οι κωδικοί δεν ταιριάζουν",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
