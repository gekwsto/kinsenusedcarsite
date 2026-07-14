import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { createLeadSchema } from "@/lib/validators/lead.schema";
import { createLead } from "@/server/services/lead.service";
import { notifyLeadCreated, retryCrmSyncIfPending } from "@/server/services/lead-notification.service";

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
    const { lead, isDuplicate } = await createLead(parsed.data, { userId: session?.user?.id, source: "website" });

    // A retried submission of the exact same form (same submissionId) must
    // return the same success response WITHOUT re-sending either email —
    // the Lead already exists and was already notified the first time.
    if (!isDuplicate) {
      // Defense in depth: notifyLeadCreated() already never throws (every
      // send is independently try/caught internally), but wrapping the call
      // itself too means even a bug in there can't turn an already-saved
      // Lead into a failed HTTP response.
      try {
        await notifyLeadCreated(lead);
      } catch (error) {
        console.error(`Lead ${lead.id} was saved but notification dispatch threw unexpectedly`, error);
      }
    } else {
      // Emails must never re-send on a duplicate — but the original
      // attempt's CRM sync may have failed (CRM outage, timeout, ...) while
      // the Lead and emails still succeeded. retryCrmSyncIfPending() is a
      // no-op once crmSyncedAt is set, so retrying here can never create a
      // second CRM Interaction for the same Lead.
      try {
        await retryCrmSyncIfPending(lead);
      } catch (error) {
        console.error(`Lead ${lead.id} duplicate submission: CRM retry threw unexpectedly`, error);
      }
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads failed", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
