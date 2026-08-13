import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPublicRealtimeScopes, isPublicRealtimeEventRelevant } from "@/lib/realtime/route-scopes";

test("matchPublicRealtimeScopes: / -> home", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/"), ["home"]);
});

test("matchPublicRealtimeScopes: /vehicles -> vehicles", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/vehicles"), ["vehicles"]);
});

test("matchPublicRealtimeScopes: /vehicles/[slug] -> vehicle-details", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/vehicles/toyota-corolla-2021"), ["vehicle-details"]);
});

test("matchPublicRealtimeScopes: /favorites -> favorites", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/favorites"), ["favorites"]);
});

test("matchPublicRealtimeScopes: /compare -> compare", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/compare"), ["compare"]);
});

test("matchPublicRealtimeScopes: /faq -> faq", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/faq"), ["faq"]);
});

test("matchPublicRealtimeScopes: /financing -> financing", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/financing"), ["financing"]);
});

test("matchPublicRealtimeScopes: /warranty -> warranty", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/warranty"), ["warranty"]);
});

test("matchPublicRealtimeScopes: /contact -> contact", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/contact"), ["contact"]);
});

test("matchPublicRealtimeScopes: routes with no realtime scope (account/login/register/privacy-policy) -> []", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/account"), []);
  assert.deepEqual(matchPublicRealtimeScopes("/login"), []);
  assert.deepEqual(matchPublicRealtimeScopes("/register"), []);
  assert.deepEqual(matchPublicRealtimeScopes("/privacy-policy"), []);
});

test("matchPublicRealtimeScopes: an unknown/admin path -> []", () => {
  assert.deepEqual(matchPublicRealtimeScopes("/admin"), []);
  assert.deepEqual(matchPublicRealtimeScopes("/admin/vehicles"), []);
  assert.deepEqual(matchPublicRealtimeScopes("/this-page-does-not-exist"), []);
});

test("isPublicRealtimeEventRelevant: a vehicles.changed-style event (scopes vehicles+vehicle-details+...) is relevant on /vehicles", () => {
  assert.equal(isPublicRealtimeEventRelevant(["home", "vehicles", "vehicle-details", "favorites", "compare"], "/vehicles"), true);
});

test("isPublicRealtimeEventRelevant: a vehicles.changed-style event is relevant on /vehicles/[slug]", () => {
  assert.equal(
    isPublicRealtimeEventRelevant(["home", "vehicles", "vehicle-details", "favorites", "compare"], "/vehicles/toyota-corolla-2021"),
    true,
  );
});

test("isPublicRealtimeEventRelevant: a vehicles.changed-style event is relevant on / (homepage depends on Vehicles)", () => {
  assert.equal(isPublicRealtimeEventRelevant(["home", "vehicles", "vehicle-details", "favorites", "compare"], "/"), true);
});

test("isPublicRealtimeEventRelevant: a vehicles.changed-style event is NOT relevant on /financing", () => {
  assert.equal(isPublicRealtimeEventRelevant(["home", "vehicles", "vehicle-details", "favorites", "compare"], "/financing"), false);
});

test("isPublicRealtimeEventRelevant: a financing content event is relevant on /financing", () => {
  assert.equal(isPublicRealtimeEventRelevant(["financing"], "/financing"), true);
});

test("isPublicRealtimeEventRelevant: a financing content event is NOT relevant on /warranty", () => {
  assert.equal(isPublicRealtimeEventRelevant(["financing"], "/warranty"), false);
});

test("isPublicRealtimeEventRelevant: all-public is relevant on every known public route", () => {
  for (const path of ["/", "/vehicles", "/vehicles/some-slug", "/favorites", "/compare", "/faq", "/financing", "/warranty", "/contact"]) {
    assert.equal(isPublicRealtimeEventRelevant(["all-public"], path), true, `expected all-public to be relevant on ${path}`);
  }
});

test("isPublicRealtimeEventRelevant: all-public IS relevant on routes with no page-specific realtime scope (they still live inside the public layout and its shared Footer)", () => {
  for (const path of ["/login", "/register", "/account", "/privacy-policy"]) {
    assert.equal(isPublicRealtimeEventRelevant(["all-public"], path), true, `expected all-public to be relevant on ${path}`);
  }
});

test("isPublicRealtimeEventRelevant: a page-specific event (e.g. financing) is still NOT relevant on a no-scope route like /login", () => {
  assert.equal(isPublicRealtimeEventRelevant(["financing"], "/login"), false);
  assert.equal(isPublicRealtimeEventRelevant(["vehicles"], "/login"), false);
});
