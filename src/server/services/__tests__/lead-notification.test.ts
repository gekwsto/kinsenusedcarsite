import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { Prisma, type Lead, type Vehicle } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { createLead } from "@/server/services/lead.service";
import {
  notifyLeadCreated,
  buildCustomerConfirmationEmail,
  buildInternalNotificationEmail,
  type LeadWithVehicle,
} from "@/server/services/lead-notification.service";
import { DEFAULT_SITE_SETTINGS } from "@/server/services/settings.service";
import type { CreateLeadInput } from "@/lib/validators/lead.schema";

// The route (`POST /api/leads`) also calls next-auth's `auth()`, which
// throws ("headers was called outside a request scope") unless invoked by
// a real Next.js request — it cannot be called directly from a plain
// node:test function. So these tests exercise the same two calls the route
// makes, in the same order, directly:
//
//   const { lead, isDuplicate } = await createLead(input, opts);
//   if (!isDuplicate) await notifyLeadCreated(lead);
//
// See src/app/api/leads/route.ts for the real (thin) wiring around this.
async function submitLeadLikeRoute(input: CreateLeadInput) {
  const result = await createLead(input, { source: "website" });
  if (!result.isDuplicate) {
    await notifyLeadCreated(result.lead).catch(() => {
      // mirrors route.ts's defense-in-depth catch
    });
  }
  return result;
}

const ENV_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "CONTACT_NOTIFICATION_EMAIL"] as const;

function withSmtpEnv(t: TestContext, overrides: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  const original: Partial<Record<string, string | undefined>> = {};
  for (const key of ENV_KEYS) original[key] = process.env[key];

  process.env.SMTP_HOST = overrides.SMTP_HOST ?? "smtp.test.local";
  process.env.SMTP_PORT = overrides.SMTP_PORT ?? "587";
  process.env.SMTP_USER = overrides.SMTP_USER ?? "test-user";
  process.env.SMTP_PASS = overrides.SMTP_PASS ?? "test-pass";
  process.env.SMTP_FROM = overrides.SMTP_FROM ?? "no-reply@kinsen.test";
  process.env.CONTACT_NOTIFICATION_EMAIL = overrides.CONTACT_NOTIFICATION_EMAIL ?? "internal@kinsen.test";

  t.after(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
}

type SendMailArgs = { to?: string; subject?: string; text?: string; html?: string };

function mockTransport(t: TestContext, impl?: (args: SendMailArgs) => unknown) {
  const sendMail = t.mock.fn(async (args: SendMailArgs) => (impl ? impl(args) : { messageId: "test" }));
  t.mock.method(nodemailer, "createTransport", () => ({ sendMail }));
  return sendMail;
}

const CRM_ENV_KEYS = ["CRM_API_BASE_URL", "CRM_LEAD_ENDPOINT_PATH", "CRM_FLOW_ID_LEASING", "CRM_FLOW_ID_PURCHASE"] as const;

function withCrmEnv(t: TestContext, overrides: Partial<Record<(typeof CRM_ENV_KEYS)[number], string>> = {}) {
  const original: Partial<Record<string, string | undefined>> = {};
  for (const key of CRM_ENV_KEYS) original[key] = process.env[key];

  process.env.CRM_API_BASE_URL = overrides.CRM_API_BASE_URL ?? "https://crm.test.local";
  process.env.CRM_LEAD_ENDPOINT_PATH = overrides.CRM_LEAD_ENDPOINT_PATH ?? "/api/InteractionAPI/CreateInteraction";
  process.env.CRM_FLOW_ID_LEASING = overrides.CRM_FLOW_ID_LEASING ?? "3001";
  process.env.CRM_FLOW_ID_PURCHASE = overrides.CRM_FLOW_ID_PURCHASE ?? "2401";

  t.after(() => {
    for (const key of CRM_ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
}

/** Mocks the (single, no-auth) CreateInteraction call. */
function mockCrmFetch(t: TestContext, interactionImpl?: (url: string) => Response | Promise<Response>) {
  const interactionCalls: { url: string; init: RequestInit }[] = [];
  const fetchMock = t.mock.method(globalThis, "fetch", async (input: string | URL, init: RequestInit = {}) => {
    const url = String(input);
    interactionCalls.push({ url, init });
    return interactionImpl ? interactionImpl(url) : new Response(JSON.stringify({ Id: 123 }), { status: 200 });
  });
  return { fetchMock, interactionCalls };
}

async function skipIfDbUnreachable(t: TestContext): Promise<boolean> {
  try {
    await prisma.lead.count();
    return false;
  } catch {
    t.skip("DATABASE_URL not reachable in this environment");
    return true;
  }
}

async function cleanupLeadsByEmail(email: string) {
  await prisma.lead.deleteMany({ where: { email } });
}

function uniqueEmail(): string {
  return `lead-notification-test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

function baseInput(overrides: Partial<CreateLeadInput> = {}): CreateLeadInput {
  return {
    firstName: "Δοκιμαστικός",
    lastName: "Χρήστης",
    email: uniqueEmail(),
    phone: "6912345678",
    message: "Θα ήθελα περισσότερες πληροφορίες.",
    interestType: "LEASING",
    vehicleId: undefined,
    consent: true,
    honeypot: "",
    submissionId: undefined,
    ...overrides,
  };
}

function fakeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "veh_test_1",
    externalCarId: null,
    slug: "toyota-corolla-2022",
    maker: "Toyota",
    model: "Corolla",
    versionName: "Corolla 1.8 Hybrid",
    yearRelease: 2022,
    price: new Prisma.Decimal(18500),
    monthlyPrice: new Prisma.Decimal(289.9),
    km: 32000,
    cc: 1798,
    hp: 122,
    fuel: "Hybrid",
    transmissionType: "Automatic",
    color: "White",
    typeOfCar: "Sedan",
    discountType: null,
    offer: false,
    froze: false,
    isDeleted: false,
    plate: null,
    vin: "JTDBU4EE0N3123456",
    description: null,
    features: null,
    seoTitle: null,
    seoDescription: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function fakeLead(overrides: Partial<Lead> = {}, vehicle: Vehicle | null = fakeVehicle()): LeadWithVehicle {
  return {
    id: "lead_test_1",
    userId: null,
    vehicleId: vehicle?.id ?? null,
    interestType: "LEASING",
    firstName: "Γιώργος",
    lastName: "Παπαδόπουλος",
    email: "customer@example.com",
    phone: "6912345678",
    message: "Ενδιαφέρομαι για το όχημα.",
    status: "NEW",
    source: "website",
    internalNotes: null,
    submissionId: null,
    createdAt: new Date("2026-07-13T10:00:00Z"),
    updatedAt: new Date("2026-07-13T10:00:00Z"),
    ...overrides,
    vehicle,
  };
}

// ---------- 1. Lead saved before email sending ----------

test("Lead is saved to the DB before any email is attempted", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));

  let foundDuringSend: boolean | null = null;
  mockTransport(t, async () => {
    const existing = await prisma.lead.findFirst({ where: { email } });
    foundDuringSend = existing !== null;
    return { messageId: "x" };
  });

  await submitLeadLikeRoute(baseInput({ email }));

  assert.equal(foundDuringSend, true, "the Lead row must already exist by the time an email send fires");
});

// ---------- 2 & 3. Both emails are sent after a successful create ----------

test("internal notification is sent to CONTACT_NOTIFICATION_EMAIL after Lead creation", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t, { CONTACT_NOTIFICATION_EMAIL: "internal@kinsen.test" });
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  const sendMail = mockTransport(t);

  await submitLeadLikeRoute(baseInput({ email }));

  const recipients = sendMail.mock.calls.map((c) => (c.arguments[0] as SendMailArgs).to);
  assert.ok(recipients.includes("internal@kinsen.test"), `expected internal recipient in: ${recipients.join(", ")}`);
});

test("customer confirmation is sent to the submitted lead email after Lead creation", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  const sendMail = mockTransport(t);

  await submitLeadLikeRoute(baseInput({ email }));

  const recipients = sendMail.mock.calls.map((c) => (c.arguments[0] as SendMailArgs).to);
  assert.ok(recipients.includes(email), `expected customer recipient in: ${recipients.join(", ")}`);
});

// ---------- 4 & 5. Interest-type wording ----------

test("Leasing email uses 'Leasing' wording", () => {
  const lead = fakeLead({ interestType: "LEASING" });
  const email = buildCustomerConfirmationEmail(lead, DEFAULT_SITE_SETTINGS);
  assert.match(email.text, /Leasing/);
  assert.match(email.html, /Leasing/);
});

test("Purchase email uses 'Αγορά' wording", () => {
  const lead = fakeLead({ interestType: "PURCHASE" });
  const email = buildCustomerConfirmationEmail(lead, DEFAULT_SITE_SETTINGS);
  assert.match(email.text, /Αγορά/);
  assert.match(email.html, /Αγορά/);
});

// ---------- 6, 7, 8. Failure isolation ----------

test("SMTP send failure does not throw and does not prevent the Lead from existing", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  mockTransport(t, async () => {
    throw new Error("simulated SMTP outage");
  });

  await assert.doesNotReject(submitLeadLikeRoute(baseInput({ email })));

  const existing = await prisma.lead.findFirst({ where: { email } });
  assert.ok(existing, "the Lead must still have been saved despite the SMTP failure");
});

test("internal email failure does not block the customer confirmation attempt", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t, { CONTACT_NOTIFICATION_EMAIL: "internal@kinsen.test" });
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));

  const sendMail = mockTransport(t, async (args) => {
    if (args.to === "internal@kinsen.test") throw new Error("simulated internal send failure");
    return { messageId: "x" };
  });

  await submitLeadLikeRoute(baseInput({ email }));

  const recipients = sendMail.mock.calls.map((c) => (c.arguments[0] as SendMailArgs).to);
  assert.ok(recipients.includes(email), "customer email must still have been attempted");
});

test("customer email failure does not block the internal notification attempt", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t, { CONTACT_NOTIFICATION_EMAIL: "internal@kinsen.test" });
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));

  const sendMail = mockTransport(t, async (args) => {
    if (args.to === email) throw new Error("simulated customer send failure");
    return { messageId: "x" };
  });

  await submitLeadLikeRoute(baseInput({ email }));

  const recipients = sendMail.mock.calls.map((c) => (c.arguments[0] as SendMailArgs).to);
  assert.ok(recipients.includes("internal@kinsen.test"), "internal email must still have been attempted");
});

// ---------- 9. Missing SMTP config ----------

test("missing SMTP config safely skips sending and logs a warning", async (t) => {
  withSmtpEnv(t);
  delete process.env.SMTP_HOST;
  const warn = t.mock.method(console, "warn", () => {});

  await assert.doesNotReject(sendEmail({ to: "someone@example.com", subject: "x", text: "y" }));

  assert.ok(warn.mock.calls.length > 0, "expected a console.warn when SMTP is not configured");
});

// ---------- 10 & 11. Duplicate submissionId retry ----------

test("duplicate retry (same submissionId) does not create a duplicate Lead row", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  const email = uniqueEmail();
  const submissionId = crypto.randomUUID();
  t.after(() => cleanupLeadsByEmail(email));
  mockTransport(t);

  const first = await createLead(baseInput({ email, submissionId }), { source: "website" });
  const second = await createLead(baseInput({ email, submissionId }), { source: "website" });

  assert.equal(first.isDuplicate, false);
  assert.equal(second.isDuplicate, true);
  assert.equal(first.lead.id, second.lead.id);

  const count = await prisma.lead.count({ where: { email } });
  assert.equal(count, 1);
});

test("duplicate retry (same submissionId) does not send duplicate emails", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t, { CONTACT_NOTIFICATION_EMAIL: "internal@kinsen.test" });
  const email = uniqueEmail();
  const submissionId = crypto.randomUUID();
  t.after(() => cleanupLeadsByEmail(email));
  const sendMail = mockTransport(t);

  await submitLeadLikeRoute(baseInput({ email, submissionId }));
  await submitLeadLikeRoute(baseInput({ email, submissionId }));

  // Exactly one round (1 internal + 1 customer) despite two submissions.
  assert.equal(sendMail.mock.calls.length, 2);
});

test("a genuinely new submission (different submissionId) still works after a prior one", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  const sendMail = mockTransport(t);

  const first = await submitLeadLikeRoute(baseInput({ email, submissionId: crypto.randomUUID() }));
  const second = await submitLeadLikeRoute(baseInput({ email, submissionId: crypto.randomUUID() }));

  assert.equal(first.isDuplicate, false);
  assert.equal(second.isDuplicate, false);
  assert.notEqual(first.lead.id, second.lead.id);

  const count = await prisma.lead.count({ where: { email } });
  assert.equal(count, 2);
  assert.equal(sendMail.mock.calls.length, 4);
});

// ---------- 12. HTML escaping ----------

test("HTML escaping prevents injection in both the customer and internal emails", () => {
  const malicious = '<script>alert(1)</script>';
  const lead = fakeLead({ firstName: malicious, lastName: malicious, message: malicious });

  const customer = buildCustomerConfirmationEmail(lead, DEFAULT_SITE_SETTINGS);
  assert.ok(!customer.html.includes("<script>"), "customer html must not contain a raw <script> tag");
  assert.ok(customer.html.includes("&lt;script&gt;"), "customer html must contain the escaped form");

  const internal = buildInternalNotificationEmail(lead);
  assert.ok(!internal.html.includes("<script>"), "internal html must not contain a raw <script> tag");
  assert.ok(internal.html.includes("&lt;script&gt;"), "internal html must contain the escaped form");
});

test("customer confirmation email never includes VIN, plate, status, or internal notes", () => {
  const lead = fakeLead(
    { internalNotes: { secret: "internal only" }, status: "WON" },
    fakeVehicle({ vin: "JTDBU4EE0N3123456", plate: "ABC-1234" }),
  );

  const customer = buildCustomerConfirmationEmail(lead, DEFAULT_SITE_SETTINGS);
  for (const forbidden of ["JTDBU4EE0N3123456", "ABC-1234", "WON", "internal only", "/admin"]) {
    assert.ok(!customer.text.includes(forbidden), `text must not contain "${forbidden}"`);
    assert.ok(!customer.html.includes(forbidden), `html must not contain "${forbidden}"`);
  }
});

// ---------- CRM lead creation ----------

test("a CRM Lead is created for a Leasing interest submission", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  withCrmEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  mockTransport(t);
  const { interactionCalls } = mockCrmFetch(t);

  await submitLeadLikeRoute(baseInput({ email, interestType: "LEASING" }));

  assert.equal(interactionCalls.length, 1);
  const body = JSON.parse(String(interactionCalls[0]!.init.body));
  assert.match(body.Title, /Leasing/);
});

test("a CRM Lead is created for a Purchase interest submission", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  withCrmEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  mockTransport(t);
  const { interactionCalls } = mockCrmFetch(t);

  await submitLeadLikeRoute(baseInput({ email, interestType: "PURCHASE" }));

  assert.equal(interactionCalls.length, 1);
  const body = JSON.parse(String(interactionCalls[0]!.init.body));
  assert.match(body.Title, /Αγορά/);
});

test("CRM failure does not block either email from being attempted", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t, { CONTACT_NOTIFICATION_EMAIL: "internal@kinsen.test" });
  withCrmEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  const sendMail = mockTransport(t);
  mockCrmFetch(t, () => new Response("Internal Server Error", { status: 500 }));

  await submitLeadLikeRoute(baseInput({ email }));

  const recipients = sendMail.mock.calls.map((c) => (c.arguments[0] as SendMailArgs).to);
  assert.ok(recipients.includes("internal@kinsen.test"), "internal email must still have been attempted");
  assert.ok(recipients.includes(email), "customer email must still have been attempted");
});

test("an email failure does not block CRM lead creation from being attempted", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  withCrmEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  mockTransport(t, async () => {
    throw new Error("simulated SMTP outage");
  });
  const { interactionCalls } = mockCrmFetch(t);

  await submitLeadLikeRoute(baseInput({ email }));

  assert.equal(interactionCalls.length, 1, "CRM lead creation must still have been attempted");
});

test("CRM failure does not throw and does not affect the local Lead", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  withCrmEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  mockTransport(t);
  mockCrmFetch(t, () => {
    throw new Error("simulated CRM outage");
  });

  await assert.doesNotReject(submitLeadLikeRoute(baseInput({ email })));

  const existing = await prisma.lead.findFirst({ where: { email } });
  assert.ok(existing, "the local Lead must still exist despite the CRM failure");
});

test("missing CRM config safely skips CRM lead creation and logs a warning, without affecting emails", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t, { CONTACT_NOTIFICATION_EMAIL: "internal@kinsen.test" });
  const original = process.env.CRM_API_BASE_URL;
  delete process.env.CRM_API_BASE_URL;
  t.after(() => {
    if (original !== undefined) process.env.CRM_API_BASE_URL = original;
  });
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  const sendMail = mockTransport(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("fetch must not be called when CRM is unconfigured");
  });

  await submitLeadLikeRoute(baseInput({ email }));

  assert.equal(fetchMock.mock.calls.length, 0, "CRM must never be called when unconfigured");
  const recipients = sendMail.mock.calls.map((c) => (c.arguments[0] as SendMailArgs).to);
  assert.ok(recipients.includes("internal@kinsen.test"));
  assert.ok(recipients.includes(email));
});

test("CRM call sends no Authorization header (the real endpoint needs none)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t);
  withCrmEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  mockTransport(t);
  const { interactionCalls } = mockCrmFetch(t);

  await submitLeadLikeRoute(baseInput({ email }));

  assert.equal(interactionCalls.length, 1);
  const headers = interactionCalls[0]!.init.headers as Record<string, string>;
  assert.equal("Authorization" in headers, false);
});

test("an unsupported interest type (FINANCING) is safely skipped without a CRM call, emails still run", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  withSmtpEnv(t, { CONTACT_NOTIFICATION_EMAIL: "internal@kinsen.test" });
  withCrmEnv(t);
  const email = uniqueEmail();
  t.after(() => cleanupLeadsByEmail(email));
  const sendMail = mockTransport(t);
  const { interactionCalls } = mockCrmFetch(t);

  await submitLeadLikeRoute(baseInput({ email, interestType: "FINANCING" }));

  assert.equal(interactionCalls.length, 0, "FINANCING has no FlowId mapping — CRM must never be called");
  const recipients = sendMail.mock.calls.map((c) => (c.arguments[0] as SendMailArgs).to);
  assert.ok(recipients.includes("internal@kinsen.test"), "emails must still run for unsupported interest types");
  assert.ok(recipients.includes(email));
});
