/**
 * Everything about *what* the two lead-related emails say, and *when* they
 * get sent. `sendEmail`/`escapeHtml` (src/lib/email.ts) stay generic; this
 * module owns the domain content: subjects, bodies, recipients, and the
 * "never let an email failure break lead submission" orchestration.
 */
import type { Lead, Vehicle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { escapeHtml, sendEmail } from "@/lib/email";
import { getSiteSettings, DEFAULT_SITE_SETTINGS, type SiteSettings } from "@/server/services/settings.service";
import { formatEuro } from "@/lib/utils";
import { createCrmLead, isCrmConfigured, isSupportedInterestType } from "@/server/services/crm.service";

export type LeadWithVehicle = Lead & { vehicle: Vehicle | null };

// Exact wording required for email content — intentionally separate from
// interest-modal.tsx's own INTEREST_LABELS (those are full sentences used as
// modal titles, e.g. "Ενδιαφέρον για Leasing"; these are short nouns for
// inline use in a sentence, e.g. "...ενδιαφέρον σας για Leasing.").
export const INTEREST_TYPE_LABELS: Record<Lead["interestType"], string> = {
  LEASING: "Leasing",
  PURCHASE: "Αγορά",
  FINANCING: "Δανειοδότηση",
  TEST_DRIVE: "Test Drive",
  GENERAL: "Γενικό ενδιαφέρον",
};

function getSiteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

function vehiclePublicUrl(vehicle: Vehicle | null): string | null {
  if (!vehicle) return null;
  return `${getSiteUrl()}/vehicles/${vehicle.slug}`;
}

function safeErrorMessage(error: unknown): string {
  // Deliberately just the message, never the full error/config object —
  // nodemailer error messages describe connection/auth failure modes, not
  // credentials, but this keeps it that way even if that ever changes.
  return error instanceof Error ? error.message : String(error);
}

interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

// Absolute URL, never a relative path: nearly every email client renders
// images by fetching them straight from the recipient's own mail app, with
// no notion of "this document's own origin" the way a browser tab has —
// a relative "/images/..." src would just 404 against the mail client's
// own (nonexistent) base URL. Reuses the same env-driven getSiteUrl() that
// vehiclePublicUrl() already relies on for the exact same reason.
function logoUrl(): string {
  return `${getSiteUrl()}/images/kinsen_logowhite.png`;
}

/**
 * Shared visual shell for both lead emails — solid colors and table-based
 * layout only (no gradients, no web fonts, no flexbox/grid): the safe
 * subset that actually renders consistently across Outlook/Gmail/Apple
 * Mail, rather than degrading gracefully in some and not at all in others.
 */
function htmlShell(title: string, bodyHtml: string, settings?: SiteSettings): string {
  const socialLinks = settings
    ? [
        settings.socialLinks.facebook ? { label: "Facebook", href: settings.socialLinks.facebook } : null,
        settings.socialLinks.instagram ? { label: "Instagram", href: settings.socialLinks.instagram } : null,
        settings.socialLinks.linkedin ? { label: "LinkedIn", href: settings.socialLinks.linkedin } : null,
      ].filter((link): link is { label: string; href: string } => link !== null)
    : [];

  return `<!doctype html>
<html lang="el">
  <body style="margin:0;padding:0;background:#eef3f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3f7;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 45px rgba(2,56,89,0.12);" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:#00899a;height:6px;line-height:6px;font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="background:#023859;padding:40px 32px;text-align:center;">
                <img src="${logoUrl()}" width="150" alt="Kinsen" style="display:block;width:150px;height:auto;margin:0 auto;border:0;outline:none;" />
              </td>
            </tr>
            <tr>
              <td style="padding:40px 36px 32px;">
                <h1 style="margin:0 0 22px;font-size:22px;line-height:1.35;color:#023859;">${escapeHtml(title)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="background:#f5f9fc;padding:24px 36px;border-top:1px solid #e2e8f0;">
                ${
                  socialLinks.length > 0
                    ? `<p style="margin:0 0 10px;font-size:12px;text-align:center;color:#7b8794;">${socialLinks
                        .map((link) => `<a href="${escapeHtml(link.href)}" style="color:#00899a;text-decoration:none;font-weight:bold;">${escapeHtml(link.label)}</a>`)
                        .join('<span style="color:#cbd5e1;"> &middot; </span>')}</p>`
                    : ""
                }
                <p style="margin:0;font-size:11px;color:#9aa5b1;text-align:center;">Kinsen Hellas &middot; ${new Date().getFullYear()}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Customer-facing confirmation. Deliberately excludes VIN, plate, internal
 * notes, lead status, admin URLs, and any other raw/internal DB field — only
 * what the customer themselves submitted or already knows (their interest
 * type, the vehicle they were looking at) belongs here.
 */
export function buildCustomerConfirmationEmail(lead: LeadWithVehicle, settings: SiteSettings): EmailContent {
  const interestLabel = INTEREST_TYPE_LABELS[lead.interestType];
  // versionName already includes the maker (e.g. "BMW Series 1 116i..."),
  // so this is deliberately not prefixed with lead.vehicle.maker again —
  // doing so rendered the brand twice in this exact email.
  const vehicleLine = lead.vehicle ? lead.vehicle.versionName : null;
  const publicUrl = vehiclePublicUrl(lead.vehicle);

  const subject = vehicleLine ? `Λάβαμε το ενδιαφέρον σας για ${vehicleLine} — Kinsen` : "Λάβαμε το ενδιαφέρον σας — Kinsen";

  const text = [
    `Γεια σας ${lead.firstName},`,
    "",
    `Σας ευχαριστούμε που επιλέξατε την Kinsen. Λάβαμε το αίτημά σας ενδιαφέροντος για ${interestLabel}${vehicleLine ? ` σχετικά με το όχημα ${vehicleLine}` : ""} και η ομάδα μας το εξετάζει ήδη.`,
    "Ένας εκπρόσωπος της Kinsen θα επικοινωνήσει μαζί σας σύντομα, για να σας καθοδηγήσει στο επόμενο βήμα.",
    ...(publicUrl ? ["", `Δείτε το όχημα: ${publicUrl}`] : []),
    "",
    "Στοιχεία επικοινωνίας Kinsen:",
    settings.contactPhone,
    settings.contactEmail,
    settings.address,
    "",
    "—",
    "Αυτό είναι ένα αυτοματοποιημένο μήνυμα, δεν χρειάζεται απάντηση.",
    "Τα στοιχεία σας χρησιμοποιούνται αποκλειστικά για την εξυπηρέτηση του αιτήματός σας.",
  ].join("\n");

  const html = htmlShell(
    "Λάβαμε το ενδιαφέρον σας",
    [
      `<p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Γεια σας <strong>${escapeHtml(lead.firstName)}</strong>,</p>`,
      `<p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#3c4a56;">Σας ευχαριστούμε που επιλέξατε την <strong style="color:#023859;">Kinsen</strong>. Λάβαμε με επιτυχία το ενδιαφέρον σας και η ομάδα μας εξετάζει ήδη το αίτημά σας — ένας εκπρόσωπός μας θα επικοινωνήσει μαζί σας σύντομα για να σας καθοδηγήσει στο επόμενο βήμα.</p>`,

      // Vehicle summary card — the request at a glance: interest-type chip,
      // vehicle name, and (when known) the year, in one visually distinct,
      // "receipt-like" block rather than buried in a sentence.
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:22px 24px;background:#f7fafc;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#e6f6f8;border-radius:999px;padding:5px 14px;">
            <span style="font-size:11px;font-weight:bold;letter-spacing:0.04em;text-transform:uppercase;color:#00727f;">${escapeHtml(interestLabel)}</span>
          </td></tr></table>
          ${
            vehicleLine
              ? `<p style="margin:14px 0 0;font-size:19px;font-weight:bold;color:#023859;">${escapeHtml(vehicleLine)}</p>${
                  lead.vehicle?.yearRelease ? `<p style="margin:4px 0 0;font-size:13px;color:#7b8794;">Μοντέλο ${escapeHtml(String(lead.vehicle.yearRelease))}</p>` : ""
                }`
              : ""
          }
        </td></tr>
      </table>`,

      `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 28px;background:#f0f9fa;border-radius:10px;"><tr><td style="padding:16px 20px;font-size:14px;line-height:1.6;color:#023859;">&#10003;&nbsp;&nbsp;Ένας εκπρόσωπος της Kinsen θα επικοινωνήσει μαζί σας σύντομα.</td></tr></table>`,
      publicUrl
        ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px;"><tr><td style="border-radius:999px;background:#023859;box-shadow:0 8px 20px rgba(2,56,89,0.35);"><a href="${escapeHtml(publicUrl)}" style="display:inline-block;padding:14px 34px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px;">Δείτε το όχημα &rarr;</a></td></tr></table>`
        : "",
      `<p style="margin:0 0 12px;font-size:11px;font-weight:bold;letter-spacing:0.04em;text-transform:uppercase;color:#94a3b8;">Στοιχεία επικοινωνίας</p>`,
      `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;">`,
      `<tr><td style="padding:4px 0;font-size:13px;color:#52616f;"><strong style="color:#023859;">Τηλέφωνο:</strong> ${escapeHtml(settings.contactPhone)}</td></tr>`,
      `<tr><td style="padding:4px 0;font-size:13px;color:#52616f;"><strong style="color:#023859;">Email:</strong> <a href="mailto:${escapeHtml(settings.contactEmail)}" style="color:#00899a;text-decoration:none;">${escapeHtml(settings.contactEmail)}</a></td></tr>`,
      `<tr><td style="padding:4px 0;font-size:13px;color:#52616f;"><strong style="color:#023859;">Διεύθυνση:</strong> ${escapeHtml(settings.address)}</td></tr>`,
      `</table>`,
      `<p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.5;color:#9aa5b1;">Αυτό είναι ένα αυτοματοποιημένο μήνυμα, δεν χρειάζεται απάντηση. Τα στοιχεία σας χρησιμοποιούνται αποκλειστικά για την εξυπηρέτηση του αιτήματός σας.</p>`,
    ].join("\n"),
    settings,
  );

  return { subject, text, html };
}

/**
 * Internal-only notification — this one intentionally DOES include
 * everything the sales team needs to act on the lead (message, phone,
 * vehicle economics), unlike the customer-facing email above.
 */
export function buildInternalNotificationEmail(lead: LeadWithVehicle): EmailContent {
  const interestLabel = INTEREST_TYPE_LABELS[lead.interestType];
  const customerName = `${lead.firstName} ${lead.lastName}`;
  const publicUrl = vehiclePublicUrl(lead.vehicle);
  const timestamp = new Intl.DateTimeFormat("el-GR", { dateStyle: "medium", timeStyle: "short" }).format(
    lead.createdAt,
  );

  const subject = `Νέο lead (${interestLabel}): ${customerName}`;

  const vehicleTextLines = lead.vehicle
    ? [
        // versionName already includes the maker — see the identical note
        // in buildCustomerConfirmationEmail above.
        `Όχημα: ${lead.vehicle.versionName}`,
        `Έτος: ${lead.vehicle.yearRelease ?? "-"}`,
        `Τιμή: ${formatEuro(lead.vehicle.price?.toString())}`,
        `Μηνιαίο: ${formatEuro(lead.vehicle.monthlyPrice?.toString())}`,
        ...(publicUrl ? [`Σύνδεσμος: ${publicUrl}`] : []),
      ]
    : [];

  const text = [
    `Lead ID: ${lead.id}`,
    `Τύπος ενδιαφέροντος: ${interestLabel}`,
    `Όνομα: ${customerName}`,
    `Email: ${lead.email}`,
    `Τηλέφωνο: ${lead.phone ?? "-"}`,
    ...vehicleTextLines,
    "",
    "Μήνυμα:",
    lead.message?.trim() || "-",
    "",
    `Ημερομηνία: ${timestamp}`,
  ].join("\n");

  const vehicleHtmlRows = lead.vehicle
    ? [
        row("Όχημα", lead.vehicle.versionName),
        row("Έτος", String(lead.vehicle.yearRelease ?? "-")),
        row("Τιμή", formatEuro(lead.vehicle.price?.toString())),
        row("Μηνιαίο", formatEuro(lead.vehicle.monthlyPrice?.toString())),
        publicUrl
          ? `<tr><td style="padding:4px 0;font-size:13px;color:#52616f;">Σύνδεσμος</td><td style="padding:4px 0;font-size:13px;"><a href="${escapeHtml(publicUrl)}" style="color:#00899a;">${escapeHtml(publicUrl)}</a></td></tr>`
          : "",
      ].join("\n")
    : "";

  function row(label: string, value: string): string {
    return `<tr><td style="padding:4px 12px 4px 0;font-size:13px;color:#52616f;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:13px;color:#1f2933;">${escapeHtml(value)}</td></tr>`;
  }

  const html = htmlShell(
    "Νέο lead",
    [
      `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">`,
      row("Lead ID", lead.id),
      row("Τύπος ενδιαφέροντος", interestLabel),
      row("Όνομα", customerName),
      row("Email", lead.email),
      row("Τηλέφωνο", lead.phone ?? "-"),
      vehicleHtmlRows,
      row("Ημερομηνία", timestamp),
      `</table>`,
      `<p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#52616f;">Μήνυμα</p>`,
      `<p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(lead.message?.trim() || "-")}</p>`,
    ].join("\n"),
  );

  return { subject, text, html };
}

export interface NotifyLeadCreatedResult {
  internalSent: boolean;
  customerSent: boolean;
  crmSent: boolean;
}

/**
 * Creates the CRM Interaction for a Lead and, only on success, stamps
 * `crmSyncedAt` so a later duplicate-submission retry (see
 * retryCrmSyncIfPending below) can tell "already synced, never touch again"
 * apart from "never synced, safe to retry". Never throws — every caller
 * treats CRM sync as best-effort.
 */
async function syncLeadToCrm(lead: LeadWithVehicle): Promise<boolean> {
  try {
    if (!isCrmConfigured()) {
      console.warn("[lead-notification] CRM_API_BASE_URL not configured — skipping CRM lead creation");
      return false;
    }
    if (!isSupportedInterestType(lead.interestType)) {
      // Routine, not noteworthy: FINANCING/TEST_DRIVE/GENERAL simply have no
      // FlowId mapping yet, unlike a real failure. No error/warn log here —
      // logging one on every such lead would just be noise.
      return false;
    }

    await createCrmLead(lead);

    await prisma.lead.update({ where: { id: lead.id }, data: { crmSyncedAt: new Date() } }).catch((error) => {
      // The CRM Interaction was created successfully — this only means the
      // *local* bookkeeping of that fact failed. Surfacing it separately
      // (rather than as a false "CRM failed") avoids a spurious retry that
      // would create a second Interaction for the same Lead.
      console.error(
        `[lead-notification] CRM lead created for ${lead.id} but failed to persist crmSyncedAt`,
        safeErrorMessage(error),
      );
    });
    return true;
  } catch (error) {
    console.error(`[lead-notification] failed to create CRM lead for local lead ${lead.id}`, safeErrorMessage(error));
    return false;
  }
}

/**
 * Fires both lead emails, and creates the corresponding CRM Lead, after a
 * successful DB write. Never throws: each of the three actions is
 * independently try/caught so one failing (or being unconfigured) can never
 * suppress the other two, and a bug here can never turn an already-saved
 * Lead into a failed HTTP response for the caller. Call this only for
 * genuinely new leads — retried/duplicate submissions must skip the emails
 * entirely and go through retryCrmSyncIfPending() instead (see the
 * `isDuplicate` check at the call site in /api/leads/route.ts).
 */
export async function notifyLeadCreated(lead: LeadWithVehicle): Promise<NotifyLeadCreatedResult> {
  const settings = await getSiteSettings().catch((error) => {
    console.error("[lead-notification] failed to load site settings, using defaults", safeErrorMessage(error));
    return DEFAULT_SITE_SETTINGS;
  });

  let internalSent = false;
  try {
    const to = process.env.CONTACT_NOTIFICATION_EMAIL?.trim();
    if (!to) {
      console.warn("[lead-notification] CONTACT_NOTIFICATION_EMAIL not configured — skipping internal notification");
    } else {
      const internal = buildInternalNotificationEmail(lead);
      await sendEmail({ to, subject: internal.subject, text: internal.text, html: internal.html });
      internalSent = true;
    }
  } catch (error) {
    console.error(`[lead-notification] failed to send internal notification for lead ${lead.id}`, safeErrorMessage(error));
  }

  let customerSent = false;
  try {
    const customer = buildCustomerConfirmationEmail(lead, settings);
    await sendEmail({ to: lead.email, subject: customer.subject, text: customer.text, html: customer.html });
    customerSent = true;
  } catch (error) {
    console.error(`[lead-notification] failed to send customer confirmation for lead ${lead.id}`, safeErrorMessage(error));
  }

  const crmSent = await syncLeadToCrm(lead);

  return { internalSent, customerSent, crmSent };
}

/**
 * Called instead of notifyLeadCreated() when /api/leads detects a duplicate
 * submission (same submissionId as an existing Lead). Both emails were
 * already sent (or attempted) on the original submission and must never
 * fire again — but unlike emails, CRM sync has a reliable done/not-done
 * marker (`crmSyncedAt`), so a Lead whose original CRM sync failed (CRM
 * outage, timeout, ...) can still recover on a later retry, while a Lead
 * whose CRM sync already succeeded is guaranteed to never get a second
 * Interaction.
 */
export async function retryCrmSyncIfPending(lead: LeadWithVehicle): Promise<boolean> {
  if (lead.crmSyncedAt) return false;
  return syncLeadToCrm(lead);
}
