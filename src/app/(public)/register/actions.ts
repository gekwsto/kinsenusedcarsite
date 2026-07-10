"use server";

import { registerUser, EmailAlreadyRegisteredError } from "@/server/services/auth.service";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth.schema";

export type RegisterActionResult = { ok: true } | { ok: false; error: string };

export async function registerAction(input: RegisterInput): Promise<RegisterActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Μη έγκυρα στοιχεία εγγραφής." };
  }

  try {
    await registerUser(parsed.data);
    return { ok: true };
  } catch (error) {
    if (error instanceof EmailAlreadyRegisteredError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Κάτι πήγε στραβά. Δοκιμάστε ξανά." };
  }
}
