import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAdminVehicleWhere } from "@/server/services/vehicle.service";

// Regression coverage for a real bug: a soft-deleted vehicle (isDeleted:
// true) kept reappearing in the admin vehicle list because the default
// ("all statuses") query never constrained `isDeleted` at all, and neither
// did the "frozen"/"offer" filters — only the explicit "active" filter
// happened to exclude it. Every filter must exclude deleted vehicles
// except the one that explicitly asks for them.

test("buildAdminVehicleWhere: no status filter (default 'all') excludes deleted vehicles", () => {
  const where = buildAdminVehicleWhere({});
  assert.equal(where.isDeleted, false);
  assert.equal(where.froze, undefined);
});

test("buildAdminVehicleWhere: status=active excludes deleted vehicles and non-frozen only", () => {
  const where = buildAdminVehicleWhere({ status: "active" });
  assert.equal(where.isDeleted, false);
  assert.equal(where.froze, false);
});

test("buildAdminVehicleWhere: status=frozen excludes deleted vehicles", () => {
  const where = buildAdminVehicleWhere({ status: "frozen" });
  assert.equal(where.isDeleted, false);
  assert.equal(where.froze, true);
});

test("buildAdminVehicleWhere: status=offer excludes deleted vehicles", () => {
  const where = buildAdminVehicleWhere({ status: "offer" });
  assert.equal(where.isDeleted, false);
  assert.equal(where.offer, true);
});

test("buildAdminVehicleWhere: status=deleted is the only filter that includes deleted vehicles", () => {
  const where = buildAdminVehicleWhere({ status: "deleted" });
  assert.equal(where.isDeleted, true);
  assert.equal(where.froze, undefined);
  assert.equal(where.offer, undefined);
});

test("buildAdminVehicleWhere: maker/fuel/transmissionType filters still apply alongside the deleted exclusion", () => {
  const where = buildAdminVehicleWhere({ maker: "Volvo", fuel: "Electric", transmissionType: "Automatic" });
  assert.equal(where.isDeleted, false);
  assert.equal(where.maker, "Volvo");
  assert.equal(where.fuel, "Electric");
  assert.equal(where.transmissionType, "Automatic");
});

test("buildAdminVehicleWhere: search builds the same insensitive OR clause across maker/model/externalCarId/vin/plate", () => {
  const where = buildAdminVehicleWhere({ search: "xc40" });
  assert.deepEqual(where.OR, [
    { maker: { contains: "xc40", mode: "insensitive" } },
    { model: { contains: "xc40", mode: "insensitive" } },
    { externalCarId: { contains: "xc40", mode: "insensitive" } },
    { vin: { contains: "xc40", mode: "insensitive" } },
    { plate: { contains: "xc40", mode: "insensitive" } },
  ]);
});
