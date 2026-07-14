/**
 * Talks to Saracakis' zCRM (Kinetic Suite) Lead-creation endpoint,
 * `POST /api/InteractionAPI/CreateInteraction`. This is a one-way,
 * fire-and-forget integration from the website's perspective: PostgreSQL
 * remains the single source of truth for the website. A CRM outage
 * (missing config, network failure, timeout, non-2xx, malformed response)
 * must never affect the local Lead — see notifyLeadCreated() in
 * lead-notification.service.ts, which wraps createCrmLead() in its own
 * independent try/catch alongside (not blocking on) the two notification
 * emails.
 *
 * Confirmed against the CRM's own OpenAPI spec
 * (https://kineticsuite.saracakis.gr/swagger/v1/swagger.json, schema
 * `InteractionAPI_InterationDTO`) rather than assumed:
 *   - Endpoint: `/api/InteractionAPI/CreateInteraction`, not `/api/Leads` —
 *     this CRM calls the concept "Interaction", not "Lead".
 *   - CustomFields items are `{ FieldId: number, Value: string }` (FieldId
 *     is a numeric reference to a field configured CRM-side). We don't
 *     have real FieldId values for anything yet, and the DTO schema
 *     declares `additionalProperties: false`, so CustomFields is sent as
 *     `[]` rather than guessing at IDs that would silently map to the
 *     wrong field (or be rejected outright). Wire up real FieldId mappings
 *     here once they're confirmed CRM-side.
 *   - Auth: despite the spec declaring a global Bearer JWT security
 *     requirement, this specific endpoint does not actually enforce it in
 *     practice for our use — confirmed empirically with a live,
 *     non-destructive request: `POST .../CreateInteraction` with an empty
 *     body and NO Authorization header returned `500
 *     {"error":"No Account was found with key: 0."}`, i.e. it reached real
 *     business logic rather than rejecting with 401. No OAuth/token flow
 *     is used here as a result — plain POST with just Content-Type.
 */
import type { LeadWithVehicle } from "@/server/services/lead-notification.service";
import { INTEREST_TYPE_LABELS } from "@/server/services/lead-notification.service";

export interface CrmAddress {
  City: string;
  Address: string;
  PostalCode: string;
  CountryCode: string;
  County: string;
}

export interface CrmAccount {
  Email: string;
  AFM: string;
  PhoneNumber: string;
  Name: string;
  Surname: string;
  CompanyName: string;
  Address: CrmAddress;
  CustomerType: string;
}

export interface CrmCustomField {
  FieldId: number;
  Value: string;
}

export interface CrmLeadPayload {
  FlowId: number;
  AccountId: number;
  CustomFields: CrmCustomField[];
  Title: string;
  Id: number;
  StatusId: number;
  Account: CrmAccount;
  Comments: string;
}

interface CrmConfig {
  baseUrl: string;
  endpointPath: string;
  statusId: number;
  accountId: number;
  timeoutMs: number;
}

// Only these two interest types map to a real CRM pipeline (Flow) right
// now. Deliberately a closed if/else, not a map with a fallback/default —
// any other interestType (FINANCING, TEST_DRIVE, GENERAL, or a future one)
// falls through to `null`, which createCrmLead() treats as "unsupported,
// skip" rather than inventing a FlowId for it.
function getFlowId(interestType: LeadWithVehicle["interestType"]): number | null {
  if (interestType === "LEASING") return Number(process.env.CRM_FLOW_ID_LEASING) || 3001;
  if (interestType === "PURCHASE") return Number(process.env.CRM_FLOW_ID_PURCHASE) || 2401;
  return null;
}

export function isSupportedInterestType(interestType: LeadWithVehicle["interestType"]): boolean {
  return getFlowId(interestType) !== null;
}

let warnedMissingConfig = false;

function normalizePathSegment(segment: string): string {
  const withLeadingSlash = segment.startsWith("/") ? segment : `/${segment}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
}

function getCrmConfig(): CrmConfig | null {
  const baseUrl = process.env.CRM_API_BASE_URL?.trim();
  if (!baseUrl) {
    if (!warnedMissingConfig) {
      console.warn("[crm] CRM_API_BASE_URL not configured — skipping CRM lead creation");
      warnedMissingConfig = true;
    }
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    endpointPath: normalizePathSegment(process.env.CRM_LEAD_ENDPOINT_PATH || "/api/InteractionAPI/CreateInteraction"),
    // One shared value across every interest type for now (confirmed with
    // the business) — FlowId is the one field that DOES vary per
    // interestType, see getFlowId() above.
    statusId: Number(process.env.CRM_STATUS_ID) || 0,
    accountId: Number(process.env.CRM_ACCOUNT_ID) || 0,
    timeoutMs: Number(process.env.CRM_TIMEOUT_MS) || 10_000,
  };
}

export function isCrmConfigured(): boolean {
  return getCrmConfig() !== null;
}

function getSiteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * Builds the CRM payload from a local Lead. The website only ever collects
 * name/email/phone/message — AFM, CompanyName and the full Address are not
 * fields on our form, so they're sent as empty strings (never omitted: the
 * contract declares them as string fields on Account/Address, and the DTO
 * schema forbids extra properties, so every field it defines must be
 * present). CustomFields is `[]` — see the module doc comment for why.
 *
 * `flowId` is passed in explicitly (rather than read from config) because
 * it depends on the Lead's interestType — see getFlowId() and
 * isSupportedInterestType(), which the caller (createCrmLead) checks before
 * ever calling this.
 */
export function buildCrmLeadPayload(lead: LeadWithVehicle, config: CrmConfig, flowId: number): CrmLeadPayload {
  const interestLabel = INTEREST_TYPE_LABELS[lead.interestType];
  const vehicleLine = lead.vehicle ? `${lead.vehicle.maker} ${lead.vehicle.versionName}` : null;
  const vehicleUrl = lead.vehicle ? `${getSiteUrl()}/vehicles/${lead.vehicle.slug}` : null;

  const commentLines = [
    `Ενδιαφέρον: ${interestLabel}`,
    ...(vehicleLine ? [`Όχημα: ${vehicleLine}${vehicleUrl ? ` (${vehicleUrl})` : ""}`] : []),
    ...(lead.message?.trim() ? ["", lead.message.trim()] : []),
    "",
    `Website Lead ID: ${lead.id}`,
  ];

  return {
    FlowId: flowId,
    AccountId: config.accountId,
    CustomFields: [],
    Title: `${interestLabel} — ${lead.firstName} ${lead.lastName}`,
    Id: 0,
    StatusId: config.statusId,
    Account: {
      Email: lead.email,
      AFM: "",
      PhoneNumber: lead.phone ?? "",
      Name: lead.firstName,
      Surname: lead.lastName,
      CompanyName: "",
      Address: { City: "", Address: "", PostalCode: "", CountryCode: "GR", County: "" },
      CustomerType: "Individual",
    },
    Comments: commentLines.join("\n"),
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.name === "TimeoutError" ? "timed out" : error.message;
  return String(error);
}

/**
 * Logs a CRM failure with enough to diagnose it (endpoint, FlowId, HTTP
 * status/content-type, a truncated snippet of the CRM's OWN response body)
 * without ever logging the outgoing payload itself (which carries the
 * customer's name/email/phone) or any secret/credential — there are none to
 * log here since this integration sends no Authorization header at all.
 */
function logCrmFailure(details: {
  url: string;
  flowId: number;
  kind: "config" | "unsupported" | "network" | "timeout" | "http_error";
  status?: number;
  contentType?: string | null;
  bodySnippet?: string;
  message: string;
}) {
  console.error("[crm] CreateInteraction failed", {
    endpoint: details.url,
    flowId: details.flowId,
    kind: details.kind,
    status: details.status,
    contentType: details.contentType,
    bodySnippet: details.bodySnippet,
    message: details.message,
  });
}

/**
 * Creates the corresponding CRM Interaction (this integration's "Lead").
 * Throws on any failure (missing config, unsupported interest type,
 * network error, timeout, non-2xx) — by design, so the caller
 * (notifyLeadCreated) can catch it independently of the two emails, exactly
 * like every other post-creation side effect. Never call this without a
 * try/catch around it.
 *
 * No authentication: confirmed live against the real CRM that
 * CreateInteraction does not require a Bearer token for this use — see the
 * module doc comment. Just Content-Type: application/json and the payload.
 */
export async function createCrmLead(lead: LeadWithVehicle): Promise<unknown> {
  const config = getCrmConfig();
  if (!config) {
    throw new Error("CRM is not configured (CRM_API_BASE_URL missing)");
  }

  const flowId = getFlowId(lead.interestType);
  if (flowId === null) {
    throw new Error(`CRM does not support interest type ${lead.interestType} — no FlowId mapping configured`);
  }

  const payload = buildCrmLeadPayload(lead, config, flowId);
  const url = `${config.baseUrl}${config.endpointPath}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    const kind = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network";
    const message = `CRM request failed: ${errorMessage(error)}`;
    logCrmFailure({ url, flowId, kind, message });
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    const bodySnippet = await response
      .text()
      .then((text) => text.slice(0, 500))
      .catch(() => "");
    const message = `CRM lead creation returned HTTP ${response.status}`;
    logCrmFailure({ url, flowId, kind: "http_error", status: response.status, contentType, bodySnippet, message });
    throw new Error(message);
  }

  return response.json().catch(() => null);
}
