import { test } from "node:test";
import assert from "node:assert/strict";
import { getRealtimeBroker } from "@/server/realtime/broker";
import { publishPublicRealtimeEvent, VEHICLE_CHANGE_SCOPES, CONTENT_KEY_SCOPE_MAP } from "@/server/realtime/publisher";
import type { PublicRealtimeEvent } from "@/lib/realtime/types";
import { CONTENT_DEFAULTS, type ContentKey } from "@/lib/content-defaults";

test("publishPublicRealtimeEvent: builds a well-formed, versioned event and delivers it via the shared broker", () => {
  const broker = getRealtimeBroker();
  const received: PublicRealtimeEvent[] = [];
  const unsubscribe = broker.subscribe((event) => received.push(event));

  try {
    publishPublicRealtimeEvent("vehicles.changed", VEHICLE_CHANGE_SCOPES);
  } finally {
    unsubscribe();
  }

  assert.equal(received.length, 1);
  const event = received[0]!;
  assert.equal(event.version, 1);
  assert.equal(event.type, "vehicles.changed");
  assert.deepEqual(event.scopes, VEHICLE_CHANGE_SCOPES);
  assert.equal(typeof event.id, "string");
  assert.ok(event.id.length > 0);
  assert.equal(Number.isNaN(Date.parse(event.occurredAt)), false, "occurredAt must be a valid ISO date string");
});

test("publishPublicRealtimeEvent: two publishes get two distinct event ids", () => {
  const broker = getRealtimeBroker();
  const received: PublicRealtimeEvent[] = [];
  const unsubscribe = broker.subscribe((event) => received.push(event));

  try {
    publishPublicRealtimeEvent("vehicles.changed", ["vehicles"]);
    publishPublicRealtimeEvent("vehicles.changed", ["vehicles"]);
  } finally {
    unsubscribe();
  }

  assert.equal(received.length, 2);
  assert.notEqual(received[0]!.id, received[1]!.id);
});

test("publishPublicRealtimeEvent: never contains a full record, only invalidation metadata (small, fixed key set)", () => {
  const broker = getRealtimeBroker();
  const received: PublicRealtimeEvent[] = [];
  const unsubscribe = broker.subscribe((event) => received.push(event));

  try {
    publishPublicRealtimeEvent("content.changed", ["financing"]);
  } finally {
    unsubscribe();
  }

  const event = received[0]!;
  assert.deepEqual(Object.keys(event).sort(), ["id", "occurredAt", "scopes", "type", "version"]);
});

test("publishPublicRealtimeEvent: a broker.publish() failure is swallowed — never throws, never affects the caller", () => {
  const broker = getRealtimeBroker();
  const unsubscribe = broker.subscribe(() => {
    throw new Error("simulated broker/listener failure with a fake secret: sk_live_should_not_leak");
  });

  const originalConsoleError = console.error;
  const loggedErrors: unknown[] = [];
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  try {
    assert.doesNotThrow(() => publishPublicRealtimeEvent("vehicles.changed", VEHICLE_CHANGE_SCOPES));
  } finally {
    unsubscribe();
    console.error = originalConsoleError;
  }
});

test("VEHICLE_CHANGE_SCOPES: targets exactly the Vehicle-dependent public scopes (home, vehicles, vehicle-details, favorites, compare) — never faq/financing/warranty/contact/all-public", () => {
  assert.deepEqual(
    [...VEHICLE_CHANGE_SCOPES].sort(),
    ["compare", "favorites", "home", "vehicle-details", "vehicles"].sort(),
  );
});

test("CONTENT_KEY_SCOPE_MAP: covers every real ContentKey exactly once, with the expected scope", () => {
  const expected: Record<ContentKey, string> = {
    "home.hero": "home",
    "home.stats": "home",
    "home.howItWorks": "home",
    "home.benefits": "home",
    "financing.hero": "financing",
    "financing.cards": "financing",
    "warranty.hero": "warranty",
    "warranty.cards": "warranty",
    "contact.hero": "contact",
    "faq.hero": "faq",
  };

  assert.deepEqual(CONTENT_KEY_SCOPE_MAP, expected);

  // Exhaustiveness against the REAL, current content-defaults.ts keys —
  // not just against a hand-typed list that could itself drift.
  const realKeys = Object.keys(CONTENT_DEFAULTS).sort();
  assert.deepEqual(Object.keys(CONTENT_KEY_SCOPE_MAP).sort(), realKeys);
});
