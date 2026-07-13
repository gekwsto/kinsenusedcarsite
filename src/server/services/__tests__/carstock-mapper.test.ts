import { test } from "node:test";
import assert from "node:assert/strict";
import {
  carStockItemSchema,
  carStockPayloadSchema,
  normalizeCarStockItemKeys,
} from "@/lib/validators/carstock.schema";
import { normalizeVehiclePayload } from "@/lib/vehicle-normalization";

// The exact payload shape the real, currently-integrated CarStock system
// sends (lower-camel-case, `delete`/`rent`/`image_url` included).
const REAL_PAYLOAD = {
  carId: 4821,
  maker: "Toyota",
  model: "Corolla",
  versionName: "1.8 Hybrid Active",
  yearRelease: "2022",
  price: 18500.5,
  km: 32000,
  cc: 1798,
  hp: 122,
  typeOfDiscount: "SEASONAL",
  fuel: "Hybrid",
  transmissionType: "Automatic",
  color: "White",
  typeOfCar: "Sedan",
  image_url: "https://carstock.example.com/photos/4821/main.jpg",
  offer: true,
  froze: false,
  delete: false,
  rent: 289.9,
  vin: "JTDBU4EE0N3123456",
};

test("real CarStock payload: parses and remaps every field to the canonical shape", () => {
  const parsed = carStockItemSchema.parse(REAL_PAYLOAD);

  assert.equal(parsed.carId, 4821);
  assert.equal(parsed.maker, "Toyota");
  assert.equal(parsed.model, "Corolla");
  assert.equal(parsed.versionName, "1.8 Hybrid Active");
  assert.equal(parsed.yearRelease, "2022");
  assert.equal(parsed.price, 18500.5);
  assert.equal(parsed.monthlyPrice, 289.9, "rent must land in monthlyPrice");
  assert.equal(parsed.km, 32000);
  assert.equal(parsed.cc, 1798);
  assert.equal(parsed.hp, 122);
  assert.equal(parsed.discountType, "SEASONAL", "typeOfDiscount must land in discountType");
  assert.equal(parsed.fuel, "Hybrid");
  assert.equal(parsed.transmissionType, "Automatic");
  assert.equal(parsed.color, "White");
  assert.equal(parsed.typeOfCar, "Sedan");
  assert.equal(parsed.imageUrl, "https://carstock.example.com/photos/4821/main.jpg");
  assert.equal(parsed.offer, true);
  assert.equal(parsed.froze, false);
  assert.equal(parsed.isDeleted, false, "delete must land in isDeleted");
  assert.equal(parsed.vin, "JTDBU4EE0N3123456");
});

test("real CarStock payload: array wrapper accepts the exact real DTO", () => {
  const parsed = carStockPayloadSchema.parse([REAL_PAYLOAD]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]!.carId, 4821);
});

test("normalizeVehiclePayload: turns the parsed real payload into typed Vehicle fields", () => {
  const parsed = carStockItemSchema.parse(REAL_PAYLOAD);
  const normalized = normalizeVehiclePayload(parsed);

  assert.equal(normalized.yearRelease, 2022, "yearRelease string must become an integer");
  assert.equal(normalized.monthlyPrice, 289.9);
  assert.equal(normalized.discountType, "SEASONAL");
  assert.equal(normalized.versionName, "1.8 Hybrid Active");
  assert.equal(normalized.vin, "JTDBU4EE0N3123456");
  assert.equal(normalized.isDeleted, false);
});

test("image_url never surfaces on the normalized Vehicle input", () => {
  const parsed = carStockItemSchema.parse(REAL_PAYLOAD);
  const normalized = normalizeVehiclePayload(parsed);

  assert.equal("imageUrl" in normalized, false);
  assert.equal("image_url" in normalized, false);
  assert.deepEqual(
    Object.keys(normalized).sort(),
    [
      "color",
      "discountType",
      "fuel",
      "froze",
      "hp",
      "isDeleted",
      "km",
      "cc",
      "maker",
      "model",
      "monthlyPrice",
      "offer",
      "plate",
      "price",
      "transmissionType",
      "typeOfCar",
      "versionName",
      "vin",
      "yearRelease",
    ].sort(),
  );
});

test("delete-only partial payload: only isDeleted is present after remap", () => {
  const parsed = carStockItemSchema.parse({ carId: 4821, delete: true });

  assert.equal(parsed.carId, 4821);
  assert.equal(parsed.isDeleted, true);
  assert.equal(parsed.maker, undefined);
  assert.equal(parsed.price, undefined);
  assert.equal(parsed.monthlyPrice, undefined);
});

test("froze-only partial payload: mirrors a minimal real-world freeze push", () => {
  const parsed = carStockItemSchema.parse({ carId: 4821, froze: true });

  assert.equal(parsed.froze, true);
  assert.equal(parsed.isDeleted, undefined);
  assert.equal(parsed.km, undefined);
});

test("legacy PascalCase payload: still accepted for backward compatibility", () => {
  const parsed = carStockItemSchema.parse({
    CarId: 999,
    Maker: "BMW",
    Model: "320d",
    YearRelease: 2019,
    Price: 15000,
    MonthlyPrice: 250,
    Km: 90000,
    Fuel: "Diesel",
    Offer: false,
    Froze: false,
    Delete: false,
    VIN: "WBA7K110707L27397",
    Plate: "ABC-1234",
  });

  assert.equal(parsed.carId, 999);
  assert.equal(parsed.maker, "BMW");
  assert.equal(parsed.model, "320d");
  assert.equal(parsed.yearRelease, 2019);
  assert.equal(parsed.monthlyPrice, 250, "legacy MonthlyPrice must still map to monthlyPrice");
  assert.equal(parsed.vin, "WBA7K110707L27397");
  assert.equal(parsed.plate, "ABC-1234");
  assert.equal(parsed.versionName, undefined, "legacy contract never had versionName");
  assert.equal(parsed.discountType, undefined, "legacy contract never had typeOfDiscount");
});

test("legacy and real payloads normalize to the same canonical key set", () => {
  const real = normalizeCarStockItemKeys({ carId: 1, maker: "Toyota" }) as Record<string, unknown>;
  const legacy = normalizeCarStockItemKeys({ CarId: 1, Maker: "Toyota" }) as Record<string, unknown>;

  assert.equal(real.carId, 1);
  assert.equal(real.maker, "Toyota");
  assert.equal(legacy.carId, 1);
  assert.equal(legacy.maker, "Toyota");
});

test("rejects a payload missing the required carId", () => {
  const result = carStockPayloadSchema.safeParse([{ maker: "Toyota" }]);
  assert.equal(result.success, false);
});
