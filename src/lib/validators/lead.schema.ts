import { z } from "zod";

export const interestTypeEnum = z.enum(["LEASING", "FINANCING", "TEST_DRIVE", "GENERAL", "PURCHASE"]);

export const createLeadSchema = z.object({
  firstName: z.string().min(1, "Το όνομα είναι υποχρεωτικό"),
  lastName: z.string().min(1, "Το επώνυμο είναι υποχρεωτικό"),
  email: z.string().email("Μη έγκυρο email"),
  phone: z.string().optional(),
  message: z.string().max(2000).optional(),
  interestType: interestTypeEnum,
  vehicleId: z.string().optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Πρέπει να αποδεχτείτε την πολιτική απορρήτου" }),
  }),
  honeypot: z.string().max(0).optional(),
  // Client-generated per-modal-open key (see interest-modal.tsx). Retrying
  // the exact same submission with the same key must be a no-op — see
  // createLead() in lead.service.ts.
  submissionId: z.string().uuid().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "IN_PROGRESS", "WON", "LOST", "SPAM"]).optional(),
  internalNotes: z.unknown().optional(),
});

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
