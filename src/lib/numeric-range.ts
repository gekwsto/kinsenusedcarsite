// Generates the ascending, deduplicated option list for a numeric filter
// dropdown (year/mileage/cc/hp — see VEHICLE_FILTER_RANGES in
// vehicle.schema.ts). Iterates by *count* rather than repeatedly adding
// `step` to a running total, so float drift (e.g. 0.1 + 0.2 !== 0.3) can
// never creep in even if a future range config uses a non-integer step.
export function createNumericRange(min: number, max: number, step: number): number[] {
  if (step <= 0 || max < min) return [];
  const count = Math.floor((max - min) / step);
  const values: number[] = [];
  for (let i = 0; i <= count; i++) {
    values.push(min + i * step);
  }
  // (max - min) isn't always an exact multiple of step — always include the
  // configured max explicitly so it's never silently missing from the list.
  if (values[values.length - 1] !== max) values.push(max);
  return values;
}
