import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getRealtimeBroker } from "@/server/realtime/broker";
import type { PublicRealtimeEvent } from "@/lib/realtime/types";
import { updatePageContent, resetPageContent } from "@/server/services/content.service";
import { createFaqItem, updateFaqItem, deleteFaqItem } from "@/server/services/faq.service";
import { updateSiteSetting, updateSiteSettings } from "@/server/services/settings.service";
import { uploadContentImage } from "@/lib/images";
import { isPublicRealtimeEventRelevant } from "@/lib/realtime/route-scopes";

async function skipIfDbUnreachable(t: TestContext): Promise<boolean> {
  try {
    await prisma.vehicle.count();
    return false;
  } catch {
    t.skip("DATABASE_URL not reachable in this environment");
    return true;
  }
}

async function capturePublishedEvents(run: () => Promise<void>): Promise<PublicRealtimeEvent[]> {
  const broker = getRealtimeBroker();
  const received: PublicRealtimeEvent[] = [];
  const unsubscribe = broker.subscribe((event) => received.push(event));
  try {
    await run();
  } finally {
    unsubscribe();
  }
  return received;
}

// ---------- PageContent ----------

test("updatePageContent: home.* publishes content.changed scoped to home", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => prisma.pageContent.delete({ where: { key: "home.hero" } }).catch(() => null));

  const events = await capturePublishedEvents(async () => {
    await updatePageContent("home.hero", {
      line1: "Realtime",
      line2: "Fixture",
      subtitle: "Realtime test fixture",
      image: "/images/homepage_banner.jpg",
    });
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "content.changed");
  assert.deepEqual(events[0]!.scopes, ["home"]);
});

test("updatePageContent: financing.* publishes content.changed scoped to financing (not warranty)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  t.after(() => prisma.pageContent.delete({ where: { key: "financing.hero" } }).catch(() => null));

  const events = await capturePublishedEvents(async () => {
    await updatePageContent("financing.hero", {
      title: "Realtime Financing Fixture",
      subtitle: "fixture",
      image: "/images/keys.jpg",
    });
  });

  assert.equal(events.length, 1);
  assert.deepEqual(events[0]!.scopes, ["financing"]);
  assert.notDeepEqual(events[0]!.scopes, ["warranty"]);
});

test("resetPageContent: an existing override publishes content.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  await updatePageContent("warranty.hero", { title: "Fixture", subtitle: "fixture", image: "/images/egguhsh.jpg" });
  t.after(() => prisma.pageContent.delete({ where: { key: "warranty.hero" } }).catch(() => null));

  const events = await capturePublishedEvents(async () => {
    await resetPageContent("warranty.hero");
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "content.changed");
  assert.deepEqual(events[0]!.scopes, ["warranty"]);
});

test("resetPageContent: resetting a key with no existing override publishes NOTHING (nothing public actually changed)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  await prisma.pageContent.delete({ where: { key: "contact.hero" } }).catch(() => null); // ensure no override exists

  const events = await capturePublishedEvents(async () => {
    const result = await resetPageContent("contact.hero");
    assert.equal(result, null);
  });

  assert.equal(events.length, 0);
});

test("image upload alone (content editor staging, not Save) publishes NOTHING", async (t) => {
  if (await skipIfDbUnreachable(t)) return;

  const fixturePath = path.join(process.cwd(), "tests/e2e/fixtures/test-image.png");
  const buffer = await readFile(fixturePath);
  const file = new File([new Uint8Array(buffer)], "test-image.png", { type: "image/png" });

  const events = await capturePublishedEvents(async () => {
    const result = await uploadContentImage(file, "home.hero");
    assert.ok(result.url, "the upload must still succeed and return a URL");
  });

  assert.equal(events.length, 0, "staging an image must never publish — only the section's own Save (updatePageContent) does");
});

// ---------- FAQ ----------

test("createFaqItem: publishes faq.changed scoped to faq", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  let createdId: string | undefined;
  t.after(async () => {
    if (createdId) await prisma.faqItem.deleteMany({ where: { id: createdId } });
  });

  const events = await capturePublishedEvents(async () => {
    const item = await createFaqItem({ question: "Realtime fixture question?", answer: "Realtime fixture answer." });
    createdId = item.id;
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "faq.changed");
  assert.deepEqual(events[0]!.scopes, ["faq"]);
});

test("updateFaqItem: publishes faq.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const item = await createFaqItem({ question: "Realtime fixture question 2?", answer: "Realtime fixture answer 2." });
  t.after(() => prisma.faqItem.deleteMany({ where: { id: item.id } }));

  const events = await capturePublishedEvents(async () => {
    await updateFaqItem(item.id, { answer: "Updated realtime fixture answer." });
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "faq.changed");
});

test("deleteFaqItem: publishes faq.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const item = await createFaqItem({ question: "Realtime fixture question 3?", answer: "Realtime fixture answer 3." });

  const events = await capturePublishedEvents(async () => {
    await deleteFaqItem(item.id);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "faq.changed");
});

// ---------- SiteSettings ----------

test("updateSiteSetting (single key, low-level): does NOT publish by itself — batching is updateSiteSettings()'s job", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const original = await prisma.siteSetting.findUnique({ where: { key: "contactEmail" } });
  t.after(async () => {
    if (original) await prisma.siteSetting.update({ where: { key: "contactEmail" }, data: { value: original.value! } });
    else await prisma.siteSetting.deleteMany({ where: { key: "contactEmail" } });
  });

  const events = await capturePublishedEvents(async () => {
    await updateSiteSetting("contactEmail", "realtime-fixture@example.com");
  });

  assert.equal(events.length, 0, "the low-level per-key updater must never publish on its own, or a multi-key PATCH would fan out N events");
});

test("updateSiteSettings: a multi-key batch publishes exactly ONE settings.changed, scoped all-public", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const originalEmail = await prisma.siteSetting.findUnique({ where: { key: "contactEmail" } });
  const originalPhone = await prisma.siteSetting.findUnique({ where: { key: "contactPhone" } });
  t.after(async () => {
    if (originalEmail) await prisma.siteSetting.update({ where: { key: "contactEmail" }, data: { value: originalEmail.value! } });
    if (originalPhone) await prisma.siteSetting.update({ where: { key: "contactPhone" }, data: { value: originalPhone.value! } });
  });

  const events = await capturePublishedEvents(async () => {
    await updateSiteSettings({ contactEmail: "realtime-fixture@example.com", contactPhone: "21 0000 0000" });
  });

  assert.equal(events.length, 1, "changing 2 keys in one request must publish exactly 1 event, not 2");
  assert.equal(events[0]!.type, "settings.changed");
  assert.deepEqual(events[0]!.scopes, ["all-public"]);
});

test("updateSiteSettings: an empty partial publishes NOTHING and performs no DB write", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const before = await prisma.siteSetting.findUnique({ where: { key: "contactEmail" } });

  const events = await capturePublishedEvents(async () => {
    await updateSiteSettings({});
  });

  assert.equal(events.length, 0);

  const after = await prisma.siteSetting.findUnique({ where: { key: "contactEmail" } });
  assert.deepEqual(after?.updatedAt, before?.updatedAt, "an empty partial must not touch any row, even one that already exists");
});

test("updateSiteSettings: a mid-batch failure rolls back the ENTIRE batch (including earlier, individually-successful writes) and publishes nothing", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const originalEmail = await prisma.siteSetting.findUnique({ where: { key: "contactEmail" } });
  t.after(async () => {
    if (originalEmail) await prisma.siteSetting.update({ where: { key: "contactEmail" }, data: { value: originalEmail.value! } });
    else await prisma.siteSetting.deleteMany({ where: { key: "contactEmail" } });
  });

  // contactEmail (first key) would succeed on its own; contactPhone's value is a
  // circular object, which cannot be JSON-serialized into the Json column and
  // makes the SECOND upsert in the same batch fail. Because both writes run
  // inside one $transaction, Prisma must roll the first write back too.
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  const events = await capturePublishedEvents(async () => {
    await assert.rejects(
      updateSiteSettings({
        contactEmail: "should-not-persist@example.com",
        contactPhone: circular as unknown as string,
      }),
    );
  });

  const afterEmail = await prisma.siteSetting.findUnique({ where: { key: "contactEmail" } });
  assert.equal(
    JSON.stringify(afterEmail?.value ?? null),
    JSON.stringify(originalEmail?.value ?? null),
    "the earlier, individually-successful write in the same batch must be rolled back too — not just the failing one",
  );
  assert.equal(events.length, 0, "no realtime event may publish when the batch didn't fully commit");
});

test("updateSiteSettings: a realtime publish failure never rolls back an already-committed write", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const originalEmail = await prisma.siteSetting.findUnique({ where: { key: "contactEmail" } });
  t.after(async () => {
    if (originalEmail) await prisma.siteSetting.update({ where: { key: "contactEmail" }, data: { value: originalEmail.value! } });
    else await prisma.siteSetting.deleteMany({ where: { key: "contactEmail" } });
  });

  const broker = getRealtimeBroker();
  const unsubscribe = broker.subscribe(() => {
    throw new Error("simulated broken SSE subscriber");
  });

  try {
    await updateSiteSettings({ contactEmail: "publish-failure-fixture@example.com" });
  } finally {
    unsubscribe();
  }

  const persisted = await prisma.siteSetting.findUnique({ where: { key: "contactEmail" } });
  assert.equal(
    persisted?.value,
    "publish-failure-fixture@example.com",
    "the write must stay committed even though a subscriber threw while handling the resulting event",
  );
});

// ---------- Business scenario: shared Footer / all-public on a no-scope route ----------

test("business scenario: a SiteSettings change reaches a visitor sitting on a no-scope route (/login) via all-public, but a financing-only event does not", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const originalEmail = await prisma.siteSetting.findUnique({ where: { key: "contactEmail" } });
  t.after(async () => {
    if (originalEmail) await prisma.siteSetting.update({ where: { key: "contactEmail" }, data: { value: originalEmail.value! } });
    else await prisma.siteSetting.deleteMany({ where: { key: "contactEmail" } });
  });

  const events = await capturePublishedEvents(async () => {
    await updateSiteSettings({ contactEmail: "footer-fixture@example.com" });
  });

  assert.equal(events.length, 1);
  const settingsEvent = events[0]!;
  assert.equal(
    isPublicRealtimeEventRelevant(settingsEvent.scopes, "/login"),
    true,
    "PublicRealtimeProvider is mounted on /login too (public layout renders the shared Footer there), so a settings change must reach it",
  );

  // A page-specific event (financing content) must NOT reach the same no-scope route.
  assert.equal(isPublicRealtimeEventRelevant(["financing"], "/login"), false);
});
