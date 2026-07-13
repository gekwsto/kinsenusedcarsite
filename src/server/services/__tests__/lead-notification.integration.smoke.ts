/**
 * Real, opt-in SMTP SMOKE TEST — sends ONE actual internal notification and
 * ONE actual customer confirmation email through the configured production
 * (or staging) SMTP provider. No mocking.
 *
 * Deliberately named `*.integration.smoke.ts`, not `*.test.ts`: the default
 * `npm test` script only globs `src/server/services/__tests__/**\/*.test.ts`,
 * so this file never runs in CI or as part of a normal `npm test` — it would
 * otherwise send real email on every test run, to whoever SMTP is configured
 * to reach.
 *
 * What this proves that the mocked suite (lead-notification.test.ts)
 * structurally cannot: that the real SMTP_HOST/PORT/USER/PASS actually
 * authenticate and actually deliver, and that CONTACT_NOTIFICATION_EMAIL is
 * a real, reachable inbox. The "an SMTP failure must never break the Lead
 * API response" guarantee itself is already covered deterministically (with
 * a simulated outage) by lead-notification.test.ts — this file is only
 * about proving real delivery with real credentials.
 *
 * Run manually:
 *   node --env-file-if-exists=.env --import tsx --test \
 *     src/server/services/__tests__/lead-notification.integration.smoke.ts
 *
 * By default the customer-confirmation half is sent to CONTACT_NOTIFICATION_EMAIL
 * too (so you only need one inbox to check both). To send it to a separate
 * real address instead, set SMOKE_TEST_CUSTOMER_EMAIL before running.
 *
 * The Lead row this creates is deleted again at the end of the test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { isSmtpConfigured } from "@/lib/email";
import { createLead } from "@/server/services/lead.service";
import { notifyLeadCreated } from "@/server/services/lead-notification.service";

const hasConfig = Boolean(isSmtpConfigured() && process.env.CONTACT_NOTIFICATION_EMAIL);

test(
  "real SMTP: internal notification and customer confirmation are both actually delivered",
  { skip: !hasConfig && "SMTP_HOST/PORT/USER/PASS and CONTACT_NOTIFICATION_EMAIL must be configured to run this" },
  async () => {
    const customerEmail = process.env.SMOKE_TEST_CUSTOMER_EMAIL?.trim() || process.env.CONTACT_NOTIFICATION_EMAIL!;

    const { lead, isDuplicate } = await createLead(
      {
        firstName: "SMOKE-TEST",
        lastName: "Kinsen",
        email: customerEmail,
        phone: "6900000000",
        message: "Αυτό είναι ένα πραγματικό, χειροκίνητο SMTP smoke test — μπορείτε να το αγνοήσετε.",
        interestType: "LEASING",
        vehicleId: undefined,
        consent: true,
        honeypot: "",
        submissionId: `smoke-test-${Date.now()}`,
      },
      { source: "smoke-test" },
    );

    try {
      assert.equal(isDuplicate, false);

      const result = await notifyLeadCreated(lead);

      assert.equal(result.internalSent, true, "internal notification must have been delivered");
      assert.equal(result.customerSent, true, "customer confirmation must have been delivered");

      const persisted = await prisma.lead.findUnique({ where: { id: lead.id } });
      assert.ok(persisted, "the Lead must exist in the database");

      console.log(
        `[smoke test] Sent — check ${process.env.CONTACT_NOTIFICATION_EMAIL} (internal) and ${customerEmail} (customer confirmation).`,
      );
    } finally {
      await prisma.lead.delete({ where: { id: lead.id } }).catch(() => null);
    }
  },
);
