import { z } from "zod";

export const createContactMessageSchema = z.object({
  firstName: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  lastName: z.string().optional(),
  email: z.string().email("Μη έγκυρο email"),
  phone: z.string().optional(),
  message: z.string().min(1, "Το μήνυμα είναι υποχρεωτικό").max(4000),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Πρέπει να αποδεχτείτε την πολιτική απορρήτου" }),
  }),
  honeypot: z.string().max(0).optional(),
});

export type CreateContactMessageInput = z.infer<typeof createContactMessageSchema>;

export const updateContactMessageSchema = z.object({
  status: z.enum(["NEW", "READ", "ARCHIVED", "SPAM"]),
});
