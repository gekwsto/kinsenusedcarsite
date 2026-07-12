import Image from "next/image";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";

const CATEGORIES = [
  { label: "Πόλης", href: "/vehicles?typeOfCar=Πόλης", image: "/images/cat-town.png" },
  { label: "Hybrid", href: "/vehicles?fuel=Hybrid", image: "/images/cat-hybrid.png" },
  { label: "Electric", href: "/vehicles?fuel=Electric", image: "/images/cat-hybrid.png" },
  { label: "SUV", href: "/vehicles?typeOfCar=SUV", image: "/images/cat-suv.png" },
  { label: "Van", href: "/vehicles?typeOfCar=Van", image: "/images/cat-van.png" },
];

const TRANSITION = "duration-[460ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

export function CategoryLinks() {
  return (
    <section className="container-page mb-16 pt-6">
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-12 sm:gap-x-12">
        {CATEGORIES.map(({ label, href, image }) => (
          <Link
            key={label}
            href={href}
            className={`group relative z-0 flex w-[140px] flex-col items-center gap-3 rounded-2xl py-2 outline-none hover:z-20 focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:w-[170px]`}
          >
            <div className="relative flex h-[140px] w-[140px] items-center justify-center overflow-visible sm:h-[160px] sm:w-[160px]">
              <div
                className={`relative z-10 h-[130px] w-[130px] transform-gpu will-change-transform transition-transform ${TRANSITION} group-hover:-translate-y-3 group-hover:scale-[1.06] group-focus-visible:-translate-y-3 group-focus-visible:scale-[1.06] motion-reduce:transform-none sm:h-[150px] sm:w-[150px]`}
              >
                <Image
                  src={image}
                  alt={label}
                  fill
                  sizes="150px"
                  className="object-contain"
                />
              </div>
            </div>
            <p
              className={`text-sm font-medium text-primary transition-[color,transform] ${TRANSITION} group-hover:-translate-y-1 group-hover:text-accent group-focus-visible:-translate-y-1 group-focus-visible:text-accent sm:text-base`}
            >
              {label}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
