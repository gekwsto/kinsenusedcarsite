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
      <div className="absolute inset-0 flex items-center bg-black/10">
        {/* Deliberately not `.container-page` (mx-auto max-w-7xl) — that
            centers the text block and leaves a growing empty gap on the
            left as the viewport widens. Padding-only, no max-width/auto-
            margins, so the text stays pinned to the true left edge of the
            banner at every screen size instead of drifting toward center. */}
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          <h1 className="group max-w-xl text-left text-3xl font-black leading-tight tracking-tight drop-shadow-[0_2px_16px_rgba(0,0,0,0.12)] transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-[3px] sm:text-5xl lg:max-w-2xl lg:text-6xl xl:max-w-3xl xl:text-7xl 2xl:max-w-4xl 2xl:text-8xl">
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
                className="absolute left-0 top-full mt-1 h-[2px] w-[72%] origin-left scale-x-0 rounded-full bg-accent opacity-0 transition-[transform,opacity] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:scale-x-100 group-hover:opacity-75 lg:h-[3px] xl:h-1"
              />
            </div>
          </h1>
          <p className="mt-3 max-w-xs text-left text-base font-normal leading-snug text-navy drop-shadow-[0_1px_8px_rgba(0,0,0,0.08)] sm:mt-4 sm:max-w-sm sm:text-lg lg:mt-5 lg:max-w-md lg:text-xl xl:mt-6 xl:max-w-lg xl:text-2xl 2xl:max-w-2xl 2xl:text-3xl">
            {content.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
