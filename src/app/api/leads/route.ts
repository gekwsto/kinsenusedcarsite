import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { createLeadSchema } from "@/lib/validators/lead.schema";
import { createLead } from "@/server/services/lead.service";

const RATE_LIMIT = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (isRateLimited(`leads:${ip}`, RATE_LIMIT, RATE_LIMIT_WINDOW_MS)) {
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

    const parsed = createLeadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const session = await auth();
    await createLead(parsed.data, { userId: session?.user?.id, source: "website" });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
