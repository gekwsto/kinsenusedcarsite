import Image from "next/image";
import { getPageContent } from "@/server/services/content.service";

export async function Hero() {
  const content = await getPageContent("home.hero");

  return (
    <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden">
      <Image
        src="/images/banner.png"
        alt="Kinsen hero image"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
        <h1 className="text-center text-3xl font-black leading-tight sm:text-5xl">
          <div className="text-navy">{content.line1}</div>
          <div className="text-accent">{content.line2}</div>
        </h1>
      </div>
    </div>
  );
}
