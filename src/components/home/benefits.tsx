import Image from "next/image";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { getPageContent } from "@/server/services/content.service";

const CARD_IMAGES = ["/images/kinsencar.png", "/images/hondaphoto.jpg", "/images/couple.jpg"];

export async function Benefits() {
  const content = await getPageContent("home.benefits");

  return (
    <section className="bg-surface py-10">
      <div className="container-page">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {content.cards.map((card, index) => (
            <div key={card.title} className="flex h-full flex-col">
              <div className="relative mb-3 aspect-video overflow-hidden rounded-2xl shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
                <Image
                  src={CARD_IMAGES[index] ?? CARD_IMAGES[0]!}
                  alt={card.title}
                  fill
                  sizes="(min-width: 768px) 33vw, 100vw"
                  className="object-cover"
                />
              </div>
              <p className="mb-2 text-lg font-bold leading-snug text-primary">{card.title}</p>
              <p className="mb-4 flex-1 text-left text-base font-light leading-loose text-primary">{card.description}</p>
              <Link
                href="/vehicles"
                className="w-fit rounded-full bg-footer px-10 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-accent hover:text-footer"
              >
                Δείτε Περισσότερα
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
