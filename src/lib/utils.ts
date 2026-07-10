import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Client-safe: kept out of lib/images.ts so components that only need the
// path (not the Node "fs" upload driver) don't pull server-only code into
// the client bundle.
export const FALLBACK_VEHICLE_IMAGE = "/images/vehicle-fallback.png";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEuro(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "-";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("el-GR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatKm(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${new Intl.NumberFormat("el-GR").format(value)} χλμ`;
}
