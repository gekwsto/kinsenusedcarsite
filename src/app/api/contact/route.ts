import { NextRequest, NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { createContactMessageSchema } from "@/lib/validators/contact.schema";
import { createContactMessage } from "@/server/services/contact.service";
import { sendNotificationEmail } from "@/lib/email";

const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (isRateLimited(`contact:${ip}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    const body = await request.json().catch(() => null);

    // Honeypot check happens on the raw body, BEFORE schema validation: the
    // schema itself enforces `honeypot` must be empty (max length 0), so a
    // filled-in honeypot would otherwise surface as a validation error
    // instead of a silent fake-success — which would tip off the bot.
    if (body && typeof body === "object" && "honeypot" in body && typeof (body as { honeypot?: unknown }).honeypot === "string" && (body as { honeypot: string }).honeypot.length > 0) {
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    const parsed = createContactMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await createContactMessage(parsed.data);

    // Best-effort notification — an SMTP outage must never fail the request.
    try {
      await sendNotificationEmail({
        subject: "Νέο μήνυμα επικοινωνίας",
        text: [
          `Νέο μήνυμα επικοινωνίας από ${parsed.data.firstName} ${parsed.data.lastName ?? ""}`.trim(),
          `Email: ${parsed.data.email}`,
          parsed.data.phone ? `Τηλέφωνο: ${parsed.data.phone}` : null,
          "",
          parsed.data.message,
        ]
          .filter((line) => line !== null)
          .join("\n"),
      });
    } catch (emailError) {
      console.error("Failed to send contact notification email", emailError);
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/contact failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
