import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CalendarDays,
  Gauge,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Car,
  CarFront,
  Shapes,
  Fuel,
  Cog,
  Zap,
  Box,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { VehicleGallery } from "@/components/vehicles/vehicle-gallery";
import { FavoriteButton } from "@/components/vehicles/favorite-button";
import { InterestModalProvider, InterestModalTrigger } from "@/components/vehicles/interest-modal";
import { VehicleGrid } from "@/components/vehicles/vehicle-grid";
import { getPublicVehicleBySlug, getSimilarVehicles } from "@/server/services/vehicle.service";
import { resolveVehicleImages, resolveVehicleImagesForList } from "@/server/services/vehicle-image.service";
import { formatEuro, formatKm } from "@/lib/utils";

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
  const vehicle = await getPublicVehicleBySlug(slug);
  if (!vehicle) notFound();

  const [similarVehiclesRaw, resolvedGallery] = await Promise.all([
    getSimilarVehicles(vehicle, 4),
    resolveVehicleImages(vehicle),
  ]);
  const similarVehicles = await resolveVehicleImagesForList(similarVehiclesRaw);
  const vehicleLabel = `${vehicle.maker} ${vehicle.versionName}${vehicle.yearRelease ? ` ${vehicle.yearRelease}` : ""}`;
  const isForSale = vehicle.price !== null;

  const specs: { icon: typeof Car; label: string; value: string }[] = [
    { icon: Car, label: "Μάρκα", value: vehicle.maker || "-" },
    { icon: CarFront, label: "Μοντέλο", value: vehicle.versionName || "-" },
    { icon: Shapes, label: "Κατηγορία", value: vehicle.typeOfCar || "-" },
    { icon: Fuel, label: "Καύσιμο", value: vehicle.fuel || "-" },
    { icon: Cog, label: "Κιβώτιο", value: vehicle.transmissionType || "-" },
    { icon: Gauge, label: "Χιλιόμετρα", value: vehicle.km !== null ? `${formatKm(vehicle.km)}` : "-" },
    { icon: Zap, label: "Ιπποδύναμη", value: vehicle.hp !== null ? `${vehicle.hp} hp` : "-" },
    { icon: Box, label: "Κυβικά", value: vehicle.cc !== null ? `${vehicle.cc} cc` : "-" },
    { icon: Palette, label: "Χρώμα", value: vehicle.color || "-" },
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
          <div className="grid grid-cols-1 gap-6 border-b border-[#e8eef2] pb-6 lg:grid-cols-[1fr_1.25fr] lg:gap-10">
            {/* Left: tabs, title, meta */}
            <div>
              <div className="mb-4 grid w-full max-w-[320px] grid-cols-2 gap-1 rounded-full border border-[#dfe8ed] bg-[#f7fafc] p-1">
                <span className="rounded-full bg-detail py-2 text-center text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(0,137,154,0.22)]">
                  Leasing
                </span>
                {isForSale && (
                  <span className="rounded-full py-2 text-center text-sm font-extrabold text-[#8a97a5]">Αγορά</span>
                )}
              </div>

              <div className="mb-3 flex items-start justify-between gap-3">
                <h1 className="text-2xl font-extrabold leading-tight text-detail-title sm:text-3xl">{vehicleLabel}</h1>
                <FavoriteButton vehicleId={vehicle.id} />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm font-bold text-[#7b8794]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-detail" /> {vehicle.yearRelease ?? "-"}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Gauge className="h-4 w-4 text-detail" /> {vehicle.km !== null ? formatKm(vehicle.km) : "-"}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-detail" /> Ελεγμένο
                </span>
              </div>
            </div>

            {/* Right: price cards, benefits, CTAs */}
            <div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {vehicle.monthlyPrice !== null && (
                  <div className="min-h-[116px] rounded-xl border border-[#dfe8ed] bg-white p-5">
                    <span className="mb-2 block font-extrabold text-detail">Leasing από</span>
                    <div className="text-2xl font-black leading-none text-detail-title">
                      {formatEuro(vehicle.monthlyPrice)}
                      <small className="text-sm font-extrabold text-[#52616f]"> /μήνα*</small>
                    </div>
                    <span className="mt-2 block font-bold text-[#52616f]">για 24 μήνες/20.000χλμ</span>
                  </div>
                )}
                {isForSale && (
                  <div className="min-h-[116px] rounded-xl border border-[#dfe8ed] bg-white p-5">
                    <span className="mb-2 block font-extrabold text-detail">Τιμή αγοράς</span>
                    <div className="text-2xl font-black leading-none text-detail-title">{formatEuro(vehicle.price)}</div>
                    <span className="mt-2 block font-bold text-[#52616f]">με ΦΠΑ</span>
                  </div>
                )}
              </div>

              <div className="my-4 flex flex-wrap gap-8 text-sm font-bold text-[#7b8794]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-detail" /> Χωρίς προκαταβολή
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-detail" /> Σταθερό μηνιαίο κόστος
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InterestModalTrigger
                  interestType="LEASING"
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-detail bg-detail px-4 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-[#004c74]"
                >
                  Ενδιαφέρομαι για Leasing <ArrowRight className="h-4 w-4" />
                </InterestModalTrigger>
                {isForSale && (
                  <InterestModalTrigger
                    interestType="GENERAL"
                    className="flex w-full items-center justify-center gap-3 rounded-lg border border-detail bg-detail px-4 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-[#004c74]"
                  >
                    Ενδιαφέρομαι για Πώληση <ArrowRight className="h-4 w-4" />
                  </InterestModalTrigger>
                )}
              </div>
            </div>
          </div>

          {/* Specs grid */}
          <div className="grid grid-cols-1 gap-x-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">
            {specs.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3.5 border-b border-[#edf2f5] px-1 py-4 last:border-b-0">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[#dfe8ed] bg-white text-detail">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <small className="block font-bold text-[#8a97a5]">{label}</small>
                  <strong className="block font-black text-detail-title">{value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary actions kept for LEASING app functionality beyond the reference (financing / test drive / general question) */}
      <div className="mx-auto mt-4 flex max-w-[1200px] flex-wrap justify-center gap-3">
        <InterestModalTrigger interestType="FINANCING" asChild>
          <Button variant="outline">Ενδιαφέρομαι για Δανειοδότηση</Button>
        </InterestModalTrigger>
        <InterestModalTrigger interestType="TEST_DRIVE" asChild>
          <Button variant="outline">Κλείστε Test Drive</Button>
        </InterestModalTrigger>
        <InterestModalTrigger interestType="GENERAL" asChild>
          <Button variant="ghost" className="group">
            <span className="relative inline-block origin-left transition-transform duration-[340ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:scale-[1.015] motion-safe:group-focus-visible:scale-[1.015]">
              Ρωτήστε μας για αυτό το όχημα
              <span
                aria-hidden="true"
                className="absolute bottom-[-4px] left-0 h-[2px] w-full origin-left scale-x-0 rounded-full bg-accent opacity-0 transition-[transform,opacity] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:scale-x-100 group-hover:opacity-[0.78] group-focus-visible:scale-x-100 group-focus-visible:opacity-[0.78]"
              />
            </span>
          </Button>
        </InterestModalTrigger>
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
