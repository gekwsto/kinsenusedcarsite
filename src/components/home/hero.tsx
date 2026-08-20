import Image from "next/image";
import { getPageContent } from "@/server/services/content.service";

// One semantic Hero tree — one <section>, one <Image>, one <h1>, one <p> —
// with every portrait/landscape-phone/tablet/desktop difference expressed
// as responsive class variants on those same elements, not as duplicated
// markup.
//
// THE HERO IMAGE INVARIANT: the source photo (`homepage_banner.jpg`,
// 1920x1080, exactly 16:9) is a fixed, locked composition — every
// vehicle, both side walls, the full floor and sky. It is NEVER
// responsively cropped, repositioned, or zoomed to make room for text, or
// to force the Hero to fit inside one viewport's height, at ANY
// viewport, with no exceptions. The section is therefore `aspect-[16/9]`
// unconditionally (no explicit `height`/`min-height` competing with it —
// per the CSS spec, either one would win over `aspect-ratio` and
// reintroduce a crop): box shape matches the image's own shape exactly,
// so `object-cover` has nothing left to crop on any edge, at any width.
// An earlier pass kept one exception here — short landscape phones fell
// back to a shorter `70vh` box, on the reasoning that a full 16:9 box
// there (~475px tall at 844px width) exceeds the phone's own viewport
// height. That reasoning was rejected: this is a normal scrollable web
// document, not a presentation slide meant to fit one screen — a Hero
// taller than a short landscape phone's viewport just means the rest of
// the page starts a little further down, exactly like it already does on
// every taller phone/tablet/desktop tier. Image integrity comes first.
//
// The *text* is what adapts instead — its size, max-width and position
// are tuned per band against how much genuinely clean wall the (always
// uncropped) photo actually shows there (measured directly against a
// 10%-grid overlay: clean from the top-left corner down the left edge,
// no vehicle pixels before roughly x:33% of the image's width, the white
// hatchback's rear bumper). Short-landscape phones keep their own
// already-compact typography tier (smaller heading/paragraph, tighter
// spacing) — that part was never about the image, only ever a size
// adjustment for a narrow phone screen, so it's unaffected by removing
// the geometry exception above it.
//
// `481px` (not a real Tailwind `screens` breakpoint) is still the split
// point for *typography/positioning* (not image geometry, which is now
// unconditional): narrower than every landscape-phone width in the test
// matrix (568px+), wider than every portrait-phone width (430px max).
// Below it, text is absolutely positioned over the photo's real safe area
// (`left-[4%] top-[4%] w-[34%]`, percentages so it scales with the
// image); at 481px+ it's released into the normal-flow, padding-driven
// content column instead (deliberately not `.container-page`, which
// would center the block and open a growing gap on the left as the
// viewport widens — padding-only keeps text pinned to the banner's true
// left edge at every width).
export async function Hero() {
  const content = await getPageContent("home.hero");

  // Forces the subtitle onto exactly two intentional lines at its natural
  // clause break (the first comma) instead of leaving it to the browser's
  // own wrap point, which grew too wide at large viewports and could
  // overlap the hero image's vehicle. Falls back to the whole string
  // un-split if the content is ever edited to no longer contain a comma,
  // so this never throws on unexpected CMS content.
  const commaIndex = content.subtitle.indexOf(", ");
  const subtitleLine1 = commaIndex === -1 ? content.subtitle : content.subtitle.slice(0, commaIndex + 1);
  const subtitleLine2 = commaIndex === -1 ? null : content.subtitle.slice(commaIndex + 2);

  return (
    <section className="relative aspect-[16/9] w-full overflow-hidden">
      <Image src={content.image} alt="Kinsen hero image" fill priority sizes="100vw" className="object-cover" />

      {/* The black tint and vertical-centering flex only apply from
          481px up — below that the text sits directly on the photo's own
          light wall (see the `<h1>`/`<p>` `drop-shadow` colors, which flip
          from a white glow on the pale wall to a black shadow once the
          tint is active), so a tint there would just darken the same wall
          for no benefit. */}
      <div className="absolute inset-0 [@media(min-width:481px)]:flex [@media(min-width:481px)]:items-center [@media(min-width:481px)]:bg-black/10">
        {/* Portrait: absolutely positioned directly over the photo's real
            safe area (percentages, so it scales with the image). From
            481px up: released back into normal flow as the padding-driven
            content column — deliberately not `.container-page` (that
            centers the block and leaves a growing empty gap on the left
            as the viewport widens); padding-only, no max-width/auto-
            margins, keeps the text pinned to the true left edge of the
            banner at every wider screen size instead of drifting toward
            center. */}
        <div className="absolute top-[4%] left-[4%] w-[34%] [@media(min-width:481px)]:static [@media(min-width:481px)]:top-auto [@media(min-width:481px)]:left-auto [@media(min-width:481px)]:w-full [@media(min-width:481px)_and_(max-width:639px)]:px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
          {/* Font sizes are `vw`-based at the base (portrait) tier rather
              than fixed rem/px specifically because the box above is a
              `%` of the full-bleed image (itself always `100vw` here) —
              sizing the type in the same unit keeps line-breaking
              behavior consistent across every width in the phone test
              matrix instead of a fixed size overflowing narrower phones
              or under-using wider ones. From 481px up this is replaced by
              the original fixed-scale ladder, and the landscape-phone
              rule at the very end compacts it further on short landscape
              viewports — purely a size adjustment, no cropping involved.
              `text-3xl` and `max-w-xl` are bounded (not left open past
              481px) specifically because Tailwind emits arbitrary
              `[@media(...)]:` variants *after* every named screen in the
              compiled stylesheet regardless of source order — an
              open-ended `[@media(min-width:481px)]:text-3xl` would keep
              beating `sm:`/`lg:`/`xl:`/`2xl:text-*` at every width above
              481px, freezing the heading at its smallest desktop-tier
              size all the way up to 1920px (verified: this exact bug
              briefly existed here). Each bound's upper edge matches where
              the *next* rule for that same property actually takes over
              in the original ladder — `max-w-xl` only changes again at
              `lg:` (1024px; `sm:` never touches max-width here), while
              `text-3xl` changes at `sm:` (640px) — so the two bounds
              differ on purpose. `leading-tight`/`drop-shadow` need no
              bound at all: nothing later in the ladder ever overrides
              either, so they're left open past 481px. */}
          <h1 className="group text-left text-[4.6vw] leading-[1.15] font-black tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.55)] transition-transform duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:hover:-translate-y-[3px] [@media(min-width:481px)_and_(max-width:1023px)]:max-w-xl [@media(min-width:481px)_and_(max-width:639px)]:text-3xl [@media(min-width:481px)]:leading-tight [@media(min-width:481px)]:drop-shadow-[0_2px_16px_rgba(0,0,0,0.12)] sm:text-5xl lg:max-w-2xl lg:text-6xl xl:max-w-3xl xl:text-7xl 2xl:max-w-4xl 2xl:text-8xl [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:text-2xl [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:max-w-[10rem] [@media(orientation:portrait)_and_(min-width:768px)_and_(max-width:1023px)]:max-w-[14rem] [@media(orientation:portrait)_and_(min-width:768px)_and_(max-width:1023px)]:text-2xl [@media(orientation:landscape)_and_(min-width:1024px)_and_(max-width:1279px)_and_(min-height:501px)]:max-w-xs [@media(orientation:landscape)_and_(min-width:1024px)_and_(max-width:1279px)_and_(min-height:501px)]:text-4xl">
            <div className="text-navy">{content.line1}</div>
            {/* No transform/transition on this line — it exists only to give
                the underline something to be `absolute`-positioned against.
                Any independent transform here (scale, transform-gpu, etc.)
                previously caused visible glyph-rasterization jitter on hover;
                the only motion now comes from the shared <h1> translateY.
                The underline itself is inert on portrait (no hover there),
                so it's shared unconditionally rather than duplicated. */}
            <div className="relative inline-block text-accent">
              {content.line2}
              <span
                aria-hidden="true"
                className="absolute left-0 top-full mt-1 h-[2px] w-[72%] origin-left scale-x-0 rounded-full bg-accent opacity-0 transition-[transform,opacity] duration-[360ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-hover:scale-x-100 group-hover:opacity-75 lg:h-[3px] xl:h-1"
              />
            </div>
          </h1>
          {/* `mt-3`/`max-w-xs`/`text-base` are bounded to `481px-639px` for
              the same cascade-order reason as the heading above: `sm:`
              overrides all three of these properties at 640px in the
              original ladder, so left open they'd freeze the paragraph at
              its smallest desktop-tier size past 640px too. `font-normal`
              and `drop-shadow` are never overridden again, so they stay
              open past 481px. */}
          <p className="mt-[2.2vw] text-left text-[2.9vw] leading-snug text-navy drop-shadow-[0_1px_6px_rgba(255,255,255,0.6)] [@media(min-width:481px)_and_(max-width:639px)]:mt-3 [@media(min-width:481px)_and_(max-width:639px)]:max-w-xs [@media(min-width:481px)_and_(max-width:639px)]:text-base [@media(min-width:481px)]:font-normal [@media(min-width:481px)]:drop-shadow-[0_1px_8px_rgba(0,0,0,0.08)] sm:mt-4 sm:max-w-sm sm:text-lg lg:mt-5 lg:max-w-md lg:text-xl xl:mt-6 xl:max-w-lg xl:text-2xl 2xl:max-w-2xl 2xl:text-3xl [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:mt-1.5 [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:max-w-[10rem] [@media(orientation:landscape)_and_(max-height:500px)_and_(max-width:1024px)]:text-xs [@media(orientation:portrait)_and_(min-width:768px)_and_(max-width:1023px)]:mt-2 [@media(orientation:portrait)_and_(min-width:768px)_and_(max-width:1023px)]:max-w-[12rem] [@media(orientation:portrait)_and_(min-width:768px)_and_(max-width:1023px)]:text-xs [@media(orientation:landscape)_and_(min-width:1024px)_and_(max-width:1279px)_and_(min-height:501px)]:mt-2 [@media(orientation:landscape)_and_(min-width:1024px)_and_(max-width:1279px)_and_(min-height:501px)]:max-w-[13rem] [@media(orientation:landscape)_and_(min-width:1024px)_and_(max-width:1279px)_and_(min-height:501px)]:text-sm">
            <span className="block">{subtitleLine1}</span>
            {subtitleLine2 && <span className="block">{subtitleLine2}</span>}
          </p>
        </div>
      </div>
    </section>
  );
}
