import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  isCrmConfigured,
  isSupportedInterestType,
  buildCrmLeadPayload,
  createCrmLead,
  type CrmLeadPayload,
} from "@/server/services/crm.service";
import type { LeadWithVehicle } from "@/server/services/lead-notification.service";
import type { Vehicle } from "@prisma/client";
import { Prisma } from "@prisma/client";

const ENV_KEYS = [
  "CRM_API_BASE_URL",
  "CRM_LEAD_ENDPOINT_PATH",
  "CRM_FLOW_ID_LEASING",
  "CRM_FLOW_ID_PURCHASE",
  "CRM_STATUS_ID",
  "CRM_ACCOUNT_ID",
  "CRM_TIMEOUT_MS",
  "SITE_URL",
] as const;

function withCrmEnv(t: TestContext, overrides: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  const original: Partial<Record<string, string | undefined>> = {};
  for (const key of ENV_KEYS) original[key] = process.env[key];

  process.env.CRM_API_BASE_URL = overrides.CRM_API_BASE_URL ?? "https://crm.example.com";
  process.env.CRM_LEAD_ENDPOINT_PATH = overrides.CRM_LEAD_ENDPOINT_PATH ?? "/api/InteractionAPI/CreateInteraction";
  process.env.CRM_FLOW_ID_LEASING = overrides.CRM_FLOW_ID_LEASING ?? "3001";
  process.env.CRM_FLOW_ID_PURCHASE = overrides.CRM_FLOW_ID_PURCHASE ?? "2401";
  process.env.CRM_STATUS_ID = overrides.CRM_STATUS_ID ?? "1";
  process.env.CRM_ACCOUNT_ID = overrides.CRM_ACCOUNT_ID ?? "0";
  process.env.CRM_TIMEOUT_MS = overrides.CRM_TIMEOUT_MS ?? "10000";
  process.env.SITE_URL = overrides.SITE_URL ?? "https://used.kinsen.gr";

  t.after(() => {
    for (const key of ENV_KEYS) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
}

function mockFetchOnce(t: TestContext, impl: (url: string, init: RequestInit) => Response | Promise<Response>) {
  return t.mock.method(globalThis, "fetch", async (input: string | URL, init: RequestInit = {}) =>
    impl(String(input), init),
  );
}

function fakeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "veh_1",
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

function fakeLead(overrides: Partial<LeadWithVehicle> = {}, vehicle: Vehicle | null = fakeVehicle()): LeadWithVehicle {
  return {
    id: "lead_1",
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

test("isCrmConfigured: false when CRM_API_BASE_URL is missing", (t) => {
  const original = process.env.CRM_API_BASE_URL;
  delete process.env.CRM_API_BASE_URL;
  t.after(() => {
    if (original !== undefined) process.env.CRM_API_BASE_URL = original;
  });
  assert.equal(isCrmConfigured(), false);
});

test("isCrmConfigured: true when CRM_API_BASE_URL is set (no auth vars required)", (t) => {
  withCrmEnv(t);
  assert.equal(isCrmConfigured(), true);
});

test("isSupportedInterestType: true for LEASING and PURCHASE", () => {
  assert.equal(isSupportedInterestType("LEASING"), true);
  assert.equal(isSupportedInterestType("PURCHASE"), true);
});

test("isSupportedInterestType: false for FINANCING, TEST_DRIVE, GENERAL — no invented FlowId", () => {
  assert.equal(isSupportedInterestType("FINANCING"), false);
  assert.equal(isSupportedInterestType("TEST_DRIVE"), false);
  assert.equal(isSupportedInterestType("GENERAL"), false);
});

test("buildCrmLeadPayload: LEASING uses FlowId 3001 (the confirmed default)", (t) => {
  withCrmEnv(t);
  const lead = fakeLead({ interestType: "LEASING" });
  const payload = buildCrmLeadPayload(
    lead,
    { baseUrl: "https://crm.example.com", endpointPath: "/api/InteractionAPI/CreateInteraction", statusId: 1, accountId: 0, timeoutMs: 10000 },
    3001,
  );
  assert.equal(payload.FlowId, 3001);
  assert.match(payload.Title, /Leasing/);
});

test("buildCrmLeadPayload: PURCHASE uses FlowId 2401 (the confirmed default)", (t) => {
  withCrmEnv(t);
  const lead = fakeLead({ interestType: "PURCHASE" });
  const payload = buildCrmLeadPayload(
    lead,
    { baseUrl: "https://crm.example.com", endpointPath: "/api/InteractionAPI/CreateInteraction", statusId: 1, accountId: 0, timeoutMs: 10000 },
    2401,
  );
  assert.equal(payload.FlowId, 2401);
  assert.match(payload.Title, /Αγορά/);
});

test("buildCrmLeadPayload: matches the CRM's InterationDTO contract exactly", (t) => {
  withCrmEnv(t);
  const lead = fakeLead();

  const payload: CrmLeadPayload = buildCrmLeadPayload(
    lead,
    { baseUrl: "https://crm.example.com", endpointPath: "/api/InteractionAPI/CreateInteraction", statusId: 1, accountId: 0, timeoutMs: 10000 },
    3001,
  );

  assert.equal(payload.AccountId, 0);
  assert.equal(payload.StatusId, 1);
  assert.equal(payload.Id, 0);
  assert.equal(typeof payload.Title, "string");
  assert.deepEqual(payload.CustomFields, []);

  assert.equal(payload.Account.Email, "customer@example.com");
  assert.equal(payload.Account.Name, "Γιώργος");
  assert.equal(payload.Account.Surname, "Παπαδόπουλος");
  assert.equal(payload.Account.PhoneNumber, "6912345678");
  assert.equal(typeof payload.Account.AFM, "string");
  assert.equal(typeof payload.Account.CompanyName, "string");
  assert.equal(payload.Account.Address.CountryCode, "GR");
  assert.equal(typeof payload.Account.Address.City, "string");
  assert.equal(typeof payload.Comments, "string");
  assert.match(payload.Comments, /Website Lead ID: lead_1/);

  // additionalProperties:false on the CRM side — the payload must contain
  // exactly these keys, nothing extra.
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["AccountId", "Account", "Comments", "CustomFields", "FlowId", "Id", "StatusId", "Title"].sort(),
  );
  assert.deepEqual(
    Object.keys(payload.Account).sort(),
    ["Email", "AFM", "PhoneNumber", "Name", "Surname", "CompanyName", "Address", "CustomerType"].sort(),
  );
  assert.deepEqual(
    Object.keys(payload.Account.Address).sort(),
    ["City", "Address", "PostalCode", "CountryCode", "County"].sort(),
  );
});

test("createCrmLead: a single plain POST to {CRM_API_BASE_URL}{CRM_LEAD_ENDPOINT_PATH}, no OAuth call", async (t) => {
  withCrmEnv(t, { CRM_API_BASE_URL: "https://crm.example.com", CRM_LEAD_ENDPOINT_PATH: "/api/InteractionAPI/CreateInteraction" });
  const calls: { url: string; init: RequestInit }[] = [];
  mockFetchOnce(t, (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ Id: 999 }), { status: 200 });
  });

  await createCrmLead(fakeLead());

  assert.equal(calls.length, 1, "exactly one HTTP call — no separate OAuth token request");
  assert.equal(calls[0]!.url, "https://crm.example.com/api/InteractionAPI/CreateInteraction");
  assert.ok(
    !calls.some((c) => c.url.includes("/OAuth/Token")),
    "must never call /OAuth/Token",
  );
});

test("createCrmLead: sends no Authorization header", async (t) => {
  withCrmEnv(t);
  let capturedHeaders: Record<string, string> = {};
  mockFetchOnce(t, (_url, init) => {
    capturedHeaders = (init.headers as Record<string, string>) ?? {};
    return new Response("{}", { status: 200 });
  });

  await createCrmLead(fakeLead());

  assert.equal("Authorization" in capturedHeaders, false, "no Authorization header must ever be sent");
  assert.equal(capturedHeaders["Content-Type"], "application/json");
});

test("createCrmLead: sends exactly Content-Type: application/json as headers", async (t) => {
  withCrmEnv(t);
  let capturedHeaders: Record<string, string> = {};
  mockFetchOnce(t, (_url, init) => {
    capturedHeaders = (init.headers as Record<string, string>) ?? {};
    return new Response("{}", { status: 200 });
  });

  await createCrmLead(fakeLead());

  assert.deepEqual(Object.keys(capturedHeaders), ["Content-Type"]);
});

test("createCrmLead: LEASING lead is POSTed with FlowId 3001", async (t) => {
  withCrmEnv(t);
  let body: CrmLeadPayload | null = null;
  mockFetchOnce(t, (_url, init) => {
    body = JSON.parse(String(init.body));
    return new Response("{}", { status: 200 });
  });

  await createCrmLead(fakeLead({ interestType: "LEASING" }));
  assert.equal((body as unknown as CrmLeadPayload).FlowId, 3001);
});

test("createCrmLead: PURCHASE lead is POSTed with FlowId 2401", async (t) => {
  withCrmEnv(t);
  let body: CrmLeadPayload | null = null;
  mockFetchOnce(t, (_url, init) => {
    body = JSON.parse(String(init.body));
    return new Response("{}", { status: 200 });
  });

  await createCrmLead(fakeLead({ interestType: "PURCHASE" }));
  assert.equal((body as unknown as CrmLeadPayload).FlowId, 2401);
});

test("createCrmLead: throws (and never calls fetch) for an unsupported interest type", async (t) => {
  withCrmEnv(t);
  let called = false;
  mockFetchOnce(t, () => {
    called = true;
    return new Response("{}", { status: 200 });
  });

  for (const interestType of ["FINANCING", "TEST_DRIVE", "GENERAL"] as const) {
    await assert.rejects(createCrmLead(fakeLead({ interestType })));
  }
  assert.equal(called, false, "an unsupported interest type must never reach fetch");
});

test("createCrmLead: throws when CRM_API_BASE_URL is missing", async (t) => {
  const original = process.env.CRM_API_BASE_URL;
  delete process.env.CRM_API_BASE_URL;
  t.after(() => {
    if (original !== undefined) process.env.CRM_API_BASE_URL = original;
  });

  await assert.rejects(createCrmLead(fakeLead()));
});

test("createCrmLead: throws on a non-2xx response", async (t) => {
  withCrmEnv(t);
  mockFetchOnce(t, () => new Response("Internal Server Error", { status: 500 }));
  await assert.rejects(createCrmLead(fakeLead()));
});

test("createCrmLead: throws on a network failure", async (t) => {
  withCrmEnv(t);
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("simulated network failure");
  });
  await assert.rejects(createCrmLead(fakeLead()));
});
