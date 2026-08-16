import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { LoginForm } from "@/components/forms/login-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Σύνδεση",
  description: "Συνδεθείτε στον λογαριασμό σας στην Kinsen για να δείτε τα αγαπημένα σας οχήματα και τα αιτήματά σας.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    // Single-card, corporate-minimal auth layout — deliberately no split
    // panel, no diagonal, no full-bleed navy surface. The page's own light
    // background (inherited from the body — see globals.css) stays visible
    // on every side, so this reads as one calm card floating on the site's
    // normal background rather than a second, competing surface. Vertical
    // padding gives breathing room under the navbar and above the shared
    // Footer; the short-viewport override keeps things from ever feeling
    // squeezed on small-height/landscape screens.
    <div className="w-full px-4 py-10 sm:px-6 sm:py-14 lg:py-20 [@media(max-height:640px)]:py-6">
      <div className="relative mx-auto flex w-full max-w-[440px] flex-col items-center">
        {/* Extremely restrained ambient depth — one soft glow behind the
            card, not a colored surface or gradient competing with it. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center">
          <div className="h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl" />
        </div>

        <Card className="w-full rounded-2xl border-border/60 shadow-card motion-safe:animate-[slide-up_450ms_ease-out_both]">
          <CardContent className="flex flex-col items-center p-6 text-center sm:p-8 lg:p-10 [@media(max-height:640px)]:p-5">
            {/* The page's one bold brand anchor — a solid navy badge tying
                to the navbar/CTA brand language — everything else stays
                deliberately quiet. Scales per breakpoint via its own fixed
                sizes rather than fluid units, so it never disturbs the
                vertical rhythm of the title/subtitle below it. */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary shadow-soft sm:h-16 sm:w-16 lg:h-20 lg:w-20 [@media(max-height:640px)]:h-12 [@media(max-height:640px)]:w-12">
              <UserRound
                aria-hidden="true"
                className="h-7 w-7 text-white sm:h-8 sm:w-8 lg:h-10 lg:w-10 [@media(max-height:640px)]:h-6 [@media(max-height:640px)]:w-6"
              />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-ink sm:text-3xl [@media(max-height:640px)]:mt-3 [@media(max-height:640px)]:text-xl">
              Καλώς ήρθατε ξανά
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted sm:text-base [@media(max-height:640px)]:mt-1">
              Συνδεθείτε στον λογαριασμό σας
            </p>

            <div className="mt-7 w-full text-left [@media(max-height:640px)]:mt-4">
              <Suspense>
                <LoginForm />
              </Suspense>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-ink-muted/80 [@media(max-height:640px)]:mt-3">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Ασφάλεια δεδομένων
        </p>
      </div>
    </div>
  );
}
