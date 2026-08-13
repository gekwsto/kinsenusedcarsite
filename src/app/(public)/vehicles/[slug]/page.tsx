import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { VehicleGallery } from "@/components/vehicles/vehicle-gallery";
import { InterestModalProvider } from "@/components/vehicles/interest-modal";
import { VehiclePricingSection } from "@/components/vehicles/vehicle-pricing-section";
import { type VehicleSpecItem } from "@/components/vehicles/vehicle-specs-tabs";
import { VehicleGrid } from "@/components/vehicles/vehicle-grid";
import { getPublicVehicleBySlug, getSimilarVehicles } from "@/server/services/vehicle.service";
import { resolveVehicleImages, resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";
import { formatKm } from "@/lib/utils";

interface PageParams {
  slug: string;
}

export async function generateMetadata({ params }: { params: Promise<PageParams> }): Promise<Metadata> {
  const { slug } = await params;
  const vehicle = await getPublicVehicleBySlug(slug);
  if (!vehicle) return {};

  const title = `Used ${vehicle.maker} ${vehicle.versionName} ${vehicle.yearRelease ?? ""}`.replace(/\s+/g, " ").trim();
  const description =
    vehicle.seoDescription ||
    vehicle.description ||
    `${vehicle.maker} ${vehicle.versionName}${vehicle.yearRelease ? ` ${vehicle.yearRelease}` : ""} — μεταχειρισμένο όχημα με leasing από την Kinsen.`;
  const resolved = await resolveVehicleImages(vehicle);
  const image = resolved.mainImage.url;

  return {
    title,
    description,
    alternates: { canonical: `/vehicles/${vehicle.slug}` },
    openGraph: {
      title: `${title} | Kinsen`,
      description,
      images: [{ url: image }],
      type: "website",
    },
  };
}

export default async function VehicleDetailPage({ params }: { params: Promise<PageParams> }) {
  const { slug } = await params;
  // Test-only hook for exercising the recoverable error.tsx boundary in a
  // real browser (see tests/e2e/public-status-states.spec.ts) — inert
  // unless KINSEN_E2E_TEST_TRIGGERS is explicitly set, which playwright.config.ts
  // only does for its own spawned webServer, never in a real deployment.
  if (process.env.KINSEN_E2E_TEST_TRIGGERS === "1" && slug === "__e2e_trigger_error__") {
    throw new Error("E2E test-only trigger for the recoverable error boundary");
  }
  const vehicle = await getPublicVehicleBySlug(slug);
  if (!vehicle) notFound();

  const [similarVehiclesRaw, resolvedGallery] = await Promise.all([
    getSimilarVehicles(vehicle, 4),
    resolveVehicleImages(vehicle),
  ]);
  const similarVehicles = await resolveVehicleImagesForList(similarVehiclesRaw);
  // versionName already includes the maker (e.g. "Volvo XC40"), so this is
  // deliberately not prefixed with vehicle.maker again — doing so used to
  // render a duplicated brand name here, in the interest-modal's "Για το
  // όχημα: …" text, and in the JSON-LD `name` field, since all three read
  // this same vehicleLabel.
  const vehicleLabel = `${vehicle.versionName}${vehicle.yearRelease ? ` ${vehicle.yearRelease}` : ""}`;

  // `icon` is deliberately not part of this data — a component reference
  // can't cross the Server -> Client Component boundary. VehiclePricingSection
  // (via SpecsGrid) resolves each `key` to its icon on the client side.
  const specs: VehicleSpecItem[] = [
    { key: "maker", label: "Μάρκα", value: vehicle.maker || "-" },
    { key: "model", label: "Μοντέλο", value: vehicle.versionName || "-" },
    { key: "category", label: "Κατηγορία", value: vehicle.typeOfCar || "-" },
    { key: "fuel", label: "Καύσιμο", value: vehicle.fuel || "-" },
    { key: "transmission", label: "Κιβώτιο", value: vehicle.transmissionType || "-" },
    { key: "km", label: "Χιλιόμετρα", value: vehicle.km !== null ? `${formatKm(vehicle.km)}` : "-" },
    { key: "hp", label: "Ιπποδύναμη", value: vehicle.hp !== null ? `${vehicle.hp} hp` : "-" },
    { key: "cc", label: "Κυβικά", value: vehicle.cc !== null ? `${vehicle.cc} cc` : "-" },
    { key: "color", label: "Χρώμα", value: vehicle.color || "-" },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: vehicleLabel,
    brand: vehicle.maker,
    model: vehicle.versionName,
    vehicleModelDate: vehicle.yearRelease ? String(vehicle.yearRelease) : undefined,
    fuelType: vehicle.fuel ?? undefined,
    vehicleTransmission: vehicle.transmissionType ?? undefined,
    color: vehicle.color ?? undefined,
    mileageFromOdometer: vehicle.km
      ? { "@type": "QuantitativeValue", value: vehicle.km, unitCode: "KMT" }
      : undefined,
    image: resolvedGallery.images.map((img) => img.url),
    offers: vehicle.price
      ? { "@type": "Offer", price: vehicle.price, priceCurrency: "EUR", availability: "https://schema.org/InStock" }
      : undefined,
  };

  return (
    <InterestModalProvider vehicleId={vehicle.id} vehicleLabel={vehicleLabel}>
    <div className="container-page py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="flex w-full justify-center">
        <VehicleGallery images={resolvedGallery.images} title={vehicleLabel} />
      </div>

      <div className="mx-auto mt-8 max-w-[1200px] rounded-3xl bg-[#f5f9fc] p-4 shadow-[0_0_12px_rgba(0,0,0,0.05)] sm:p-8">
        <div className="rounded-2xl border border-primary/10 bg-white p-5 shadow-[0_18px_55px_rgba(2,56,89,0.08)] sm:p-7">
          <VehiclePricingSection
            vehicleId={vehicle.id}
            vehicleSlug={vehicle.slug}
            vehicleLabel={vehicleLabel}
            maker={vehicle.maker}
            versionName={vehicle.versionName}
            yearRelease={vehicle.yearRelease}
            km={vehicle.km}
            monthlyPrice={vehicle.monthlyPrice}
            price={vehicle.price}
            fuel={vehicle.fuel}
            transmissionType={vehicle.transmissionType}
            imageUrl={resolvedGallery.mainImage.url}
            specs={specs}
            extras={vehicle.extras.map((extra) => ({ id: extra.id, displayName: extra.displayName }))}
          />
        </div>
      </div>

      {similarVehicles.length > 0 && (
        <>
          <Separator className="my-10" />
          <div>
            <h2 className="mb-5 text-xl font-semibold text-ink">Παρόμοια οχήματα</h2>
            <VehicleGrid vehicles={similarVehicles} cardVariant="related" />
          </div>
        </>
      )}
    </div>
    </InterestModalProvider>
  );
}
