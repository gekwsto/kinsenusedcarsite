import Image from "next/image";

export function InfoHero({ image, title, subtitle }: { image: string; title: string; subtitle?: string }) {
  return (
    <div className="container-page my-8 text-center">
      <div className="relative mx-auto h-[280px] w-full overflow-hidden rounded-xl shadow-lg sm:h-[400px] lg:h-[500px]">
        <Image src={image} alt={title} fill sizes="(min-width: 1024px) 1024px, 100vw" className="object-cover" priority />
      </div>
      <h1 className="mt-6 text-xl font-normal text-accent sm:text-2xl lg:text-3xl">{title}</h1>
      {subtitle ? <h2 className="mt-2 text-base font-normal text-navy sm:text-lg">{subtitle}</h2> : null}
    </div>
  );
}
