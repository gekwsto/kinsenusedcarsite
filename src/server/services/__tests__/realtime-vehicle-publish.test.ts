import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { getRealtimeBroker } from "@/server/realtime/broker";
import type { PublicRealtimeEvent } from "@/lib/realtime/types";
import {
  createVehicle,
  updateVehicle,
  setVehicleFrozen,
  softDeleteVehicle,
  addVehicleImage,
  removeVehicleImage,
  reorderVehicleImages,
} from "@/server/services/vehicle.service";
import type { VehicleAdminInput } from "@/lib/validators/vehicle.schema";

// Admin single-Vehicle mutations must publish exactly one vehicles.changed
// event, scoped to every Vehicle-dependent public surface, and ONLY when
// the mutation genuinely succeeded (never for a not-found update/removal).

async function skipIfDbUnreachable(t: TestContext): Promise<boolean> {
  try {
    await prisma.vehicle.count();
    return false;
  } catch {
    t.skip("DATABASE_URL not reachable in this environment");
    return true;
  }
}

async function cleanupVehicle(id: string) {
  await prisma.vehicle.deleteMany({ where: { id } });
}

function baseAdminInput(overrides: Partial<VehicleAdminInput> = {}): VehicleAdminInput {
  return {
    maker: "Toyota",
    model: "Corolla Realtime Fixture",
    versionName: "1.8 Hybrid",
    offer: false,
    froze: false,
    isDeleted: false,
    ...overrides,
  } as VehicleAdminInput;
}

/** Subscribes for the duration of `run`, returning every event received. */
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

test("createVehicle: publishes exactly one vehicles.changed event, scoped to every Vehicle-dependent surface", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  let createdId: string | undefined;
  t.after(async () => {
    if (createdId) await cleanupVehicle(createdId);
  });

  const events = await capturePublishedEvents(async () => {
    const vehicle = await createVehicle(baseAdminInput());
    createdId = vehicle.id;
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
  assert.deepEqual([...events[0]!.scopes].sort(), ["compare", "favorites", "home", "vehicle-details", "vehicles"].sort());
});

test("updateVehicle: an existing Vehicle publishes vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const created = await createVehicle(baseAdminInput({ model: "Corolla Update Fixture" }));
  t.after(() => cleanupVehicle(created.id));

  const events = await capturePublishedEvents(async () => {
    await updateVehicle(created.id, { price: 15000 });
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("updateVehicle: a not-found id publishes NOTHING", async (t) => {
  if (await skipIfDbUnreachable(t)) return;

  const events = await capturePublishedEvents(async () => {
    const result = await updateVehicle("does-not-exist-id", { price: 1 });
    assert.equal(result, null);
  });

  assert.equal(events.length, 0);
});

test("setVehicleFrozen: publishes vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const created = await createVehicle(baseAdminInput({ model: "Corolla Freeze Fixture" }));
  t.after(() => cleanupVehicle(created.id));

  const events = await capturePublishedEvents(async () => {
    await setVehicleFrozen(created.id, true);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("softDeleteVehicle: publishes vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const created = await createVehicle(baseAdminInput({ model: "Corolla SoftDelete Fixture" }));
  t.after(() => cleanupVehicle(created.id));

  const events = await capturePublishedEvents(async () => {
    await softDeleteVehicle(created.id);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("addVehicleImage: publishes vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const created = await createVehicle(baseAdminInput({ model: "Corolla AddImage Fixture" }));
  t.after(() => cleanupVehicle(created.id));

  const events = await capturePublishedEvents(async () => {
    await addVehicleImage(created.id, "https://example.com/photo.jpg", { isMain: true });
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("removeVehicleImage: an existing image publishes vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const created = await createVehicle(baseAdminInput({ model: "Corolla RemoveImage Fixture" }));
  t.after(() => cleanupVehicle(created.id));
  const image = await addVehicleImage(created.id, "https://example.com/photo.jpg");

  const events = await capturePublishedEvents(async () => {
    await removeVehicleImage(created.id, image.id);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("removeVehicleImage: a not-found imageId publishes NOTHING", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const created = await createVehicle(baseAdminInput({ model: "Corolla RemoveImageMissing Fixture" }));
  t.after(() => cleanupVehicle(created.id));

  const events = await capturePublishedEvents(async () => {
    const result = await removeVehicleImage(created.id, "does-not-exist-image-id");
    assert.equal(result, null);
  });

  assert.equal(events.length, 0);
});

test("reorderVehicleImages: publishes vehicles.changed", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const created = await createVehicle(baseAdminInput({ model: "Corolla Reorder Fixture" }));
  t.after(() => cleanupVehicle(created.id));
  const imageA = await addVehicleImage(created.id, "https://example.com/a.jpg");
  const imageB = await addVehicleImage(created.id, "https://example.com/b.jpg");

  const events = await capturePublishedEvents(async () => {
    await reorderVehicleImages(created.id, [imageB.id, imageA.id]);
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]!.type, "vehicles.changed");
});

test("a broker failure during createVehicle never breaks the mutation itself (business logic > realtime)", async (t) => {
  if (await skipIfDbUnreachable(t)) return;
  const broker = getRealtimeBroker();
  const unsubscribe = broker.subscribe(() => {
    throw new Error("simulated realtime failure");
  });

  const originalConsoleError = console.error;
  console.error = () => {};

  let createdId: string | undefined;
  try {
    const vehicle = await createVehicle(baseAdminInput({ model: "Corolla Realtime Failure Fixture" }));
    createdId = vehicle.id;
    assert.ok(vehicle.id, "the Vehicle must still be created successfully");
  } finally {
    console.error = originalConsoleError;
    unsubscribe();
    if (createdId) await cleanupVehicle(createdId);
  }
});
