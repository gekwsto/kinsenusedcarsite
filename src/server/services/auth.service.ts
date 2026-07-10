import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { RegisterInput } from "@/lib/validators/auth.schema";
import { AppError } from "@/lib/errors";

export const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export class EmailAlreadyRegisteredError extends AppError {
  constructor() {
    super("Το email χρησιμοποιείται ήδη", 409);
  }
}

export async function registerUser(input: RegisterInput) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new EmailAlreadyRegisteredError();

  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
    },
  });
}
