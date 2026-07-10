import type { MetadataRoute } from "next";
import { getActiveDisplayVehicles } from "@/server/services/vehicle.service";

const SITE_URL = process.env.SITE_URL ?? "http://localhost:3000";

// Vehicle inventory changes constantly (stock webhook, admin edits) — render
// per-request rather than freezing the vehicle list at build time.
export const dynamic = "force-dynamic";

const STATIC_PATHS = ["", "/vehicles", "/financing", "/warranty", "/contact", "/faq"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vehicles = await getActiveDisplayVehicles();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  const vehicleEntries: MetadataRoute.Sitemap = vehicles.map((vehicle) => ({
    url: `${SITE_URL}/vehicles/${vehicle.slug}`,
    lastModified: vehicle.updatedAt,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticEntries, ...vehicleEntries];
}
