import Image from "next/image";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { getPageContent } from "@/server/services/content.service";
import { Button } from "@/components/ui/button";
import { KINSEN_CTA_BUTTON_CLASSNAME } from "@/components/ui/kinsen-cta-button";
import { cn } from "@/lib/utils";

export async function Benefits() {
  const content = await getPageContent("home.benefits");

  return (
    <section className="bg-surface py-10">
      <div className="container-page">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {content.cards.map((card) => (
            <div key={card.title} className="flex h-full flex-col">
              <div className="relative mb-3 aspect-video overflow-hidden rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
                <Image
                  src={card.image}
                  alt={card.title}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover"
                />
              </div>
              <p className="mb-2 text-lg font-bold leading-snug text-primary">{card.title}</p>
              <p className="mb-4 flex-1 text-left text-base font-light leading-loose text-primary">{card.description}</p>
              {/* Same static Kinsen corporate CTA as "Σύνδεση" (see
                  kinsen-cta-button.tsx) — a larger content-section sizing
                  of its own, same structured `rounded-md` family the rest
                  of the CTA system uses. `w-fit` keeps it from stretching
                  to the full width of this column-flex card. */}
              <Button
                asChild
                variant="primary"
                className={cn(KINSEN_CTA_BUTTON_CLASSNAME, "h-auto w-fit rounded-md px-8 py-3.5 text-sm sm:px-10 sm:text-[15px] lg:text-base")}
              >
                <Link href="/vehicles">Δείτε Περισσότερα</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
