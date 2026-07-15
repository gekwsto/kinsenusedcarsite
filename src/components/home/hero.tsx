import Image from "next/image";
import { getPageContent } from "@/server/services/content.service";

export async function Hero() {
  const content = await getPageContent("home.hero");

  return (
    <div className="relative h-[70vh] min-h-[420px] w-full overflow-hidden">
      <Image
        src={content.image}
        alt="Kinsen hero image"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/10">
        <h1
          className="group text-center text-3xl font-black leading-tight transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-[3px] sm:text-5xl"
        >
          <div className="text-navy">{content.line1}</div>
          {/* No transform/transition on this line — it exists only to give
              the underline something to be `absolute`-positioned against.
              Any independent transform here (scale, transform-gpu, etc.)
              previously caused visible glyph-rasterization jitter on hover;
              the only motion now comes from the shared <h1> translateY. */}
          <div className="relative inline-block text-accent">
            {content.line2}
            <span
              aria-hidden="true"
              className="absolute left-0 top-full mt-1 h-[2px] w-[72%] origin-left scale-x-0 rounded-full bg-accent opacity-0 transition-[transform,opacity] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:scale-x-100 group-hover:opacity-75"
            />
          </div>
        </h1>
      </div>
    </div>
  );
}
