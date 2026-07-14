/**
 * Real, opt-in CRM SMOKE TEST — creates ONE real Interaction against the
 * actual Saracakis zCRM (Kinetic Suite). No mocking, no authentication (see
 * the module doc comment in crm.service.ts for why: confirmed live that
 * CreateInteraction doesn't enforce the Bearer requirement its own OpenAPI
 * spec declares).
 *
 * Deliberately named `*.integration.smoke.ts`, not `*.test.ts`: the default
 * `npm test` script only globs `src/server/services/__tests__/**\/*.test.ts`,
 * so this file never runs in CI or as part of a normal `npm test` — it would
 * otherwise create real data in the CRM on every test run.
 *
 * What this proves that the mocked suite (crm.service.test.ts) structurally
 * cannot: that the real endpoint actually accepts this exact payload shape
 * (not just shape-matched against its OpenAPI spec) and returns 2xx. "A CRM
 * failure must never affect the local Lead" is already covered
 * deterministically (with simulated failures) by lead-notification.test.ts
 * — this file is only about proving the real thing works end-to-end.
 *
 * Run manually, once CRM_API_BASE_URL is set in .env:
 *   node --env-file-if-exists=.env --import tsx --test \
 *     src/server/services/__tests__/crm.service.integration.smoke.ts
 *
 * This creates a real record in the CRM (there is no delete endpoint in the
 * CRM's API to clean it up afterwards) — it's clearly tagged in
 * Title/Comments so it's easy to find and remove manually in the CRM UI.
 * Run at most once per verification; don't loop this.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isCrmConfigured, createCrmLead } from "@/server/services/crm.service";
import type { LeadWithVehicle } from "@/server/services/lead-notification.service";

const hasConfig = isCrmConfigured();

test(
  "real CRM: creates one real Interaction, no auth header, HTTP 2xx",
  { skip: !hasConfig && "CRM_API_BASE_URL must be configured to run this" },
  async () => {
    const fakeLead: LeadWithVehicle = {
      id: `smoke-test-${Date.now()}`,
      userId: null,
      vehicleId: null,
      interestType: "LEASING",
      firstName: "SMOKE-TEST",
      lastName: "Kinsen-DoNotContact",
      email: "smoke-test@example.com",
      phone: "6900000000",
      message: "[SMOKE TEST] Αυτόματο, χειροκίνητα εκτελεσμένο τεστ ενσωμάτωσης — παρακαλώ αγνοήστε/διαγράψτε.",
      status: "NEW",
      source: "smoke-test",
      internalNotes: null,
      submissionId: null,
      crmSyncedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      vehicle: null,
    };

    const result = await createCrmLead(fakeLead);
    console.log("[smoke test] CRM accepted the Interaction. Response:", JSON.stringify(result));
    assert.ok(true, "createCrmLead resolved without throwing — see logged response above");
  },
);
