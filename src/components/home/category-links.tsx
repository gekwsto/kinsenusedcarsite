import Image from "next/image";
import Link from "next/link";

const CATEGORIES = [
  { label: "Πόλης", href: "/vehicles?typeOfCar=Πόλης", image: "/images/cat-town.png" },
  { label: "Hybrid", href: "/vehicles?fuel=Hybrid", image: "/images/cat-hybrid.png" },
  { label: "Electric", href: "/vehicles?fuel=Electric", image: "/images/cat-hybrid.png" },
  { label: "SUV", href: "/vehicles?typeOfCar=SUV", image: "/images/cat-suv.png" },
  { label: "Van", href: "/vehicles?typeOfCar=Van", image: "/images/cat-van.png" },
];

export function CategoryLinks() {
  return (
    <section className="container-page mb-16 pt-6">
      <div className="flex flex-wrap justify-center gap-4">
        {CATEGORIES.map(({ label, href, image }) => (
          <Link key={label} href={href} className="group">
            <div className="flex h-[230px] w-[230px] flex-col items-center justify-center rounded-full bg-white p-6 text-center transition-transform group-hover:scale-105">
              <div className="relative mb-2 h-[180px] w-[180px]">
                <Image src={image} alt={label} fill sizes="180px" className="object-contain" />
              </div>
              <p className="font-medium text-primary">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
