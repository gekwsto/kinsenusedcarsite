import type { Metadata } from "next";
import { Suspense } from "react";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/forms/login-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Σύνδεση",
  description: "Συνδεθείτε στον λογαριασμό σας στην Kinsen για να δείτε τα αγαπημένα σας οχήματα και τα αιτήματά σας.",
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    // Full-width outer strip only supplies the page's own light background
    // and the horizontal/vertical gutters around the bounded window below —
    // it deliberately carries no border/shadow/rounding of its own, so the
    // window reads as one self-contained surface floating on the page
    // rather than a second nested frame.
    <div className="w-full px-4 py-8 sm:px-6 lg:px-10 lg:py-10 xl:px-12 [@media(max-height:500px)]:py-4">
      {/* The auth window: one bounded, rounded, shadowed surface — capped
          well short of the viewport on desktop so the page's own
          background stays visible on every side, and the shared Footer
          (rendered by the layout right after this) stays a clearly
          separate element rather than something this page visually
          annexes. */}
      <div className="relative mx-auto w-full max-w-[1480px] overflow-hidden rounded-[28px] border border-border/60 bg-surface shadow-[0_32px_64px_-24px_rgba(2,56,89,0.28),0_8px_20px_-8px_rgba(2,56,89,0.12)] lg:min-h-[600px]">
        {/* Diagonal navy backdrop, desktop/tablet-large only. A single
            clip-path–shaped absolute layer spanning the whole window (not
            two panels whose edges must be kept in sync), clipped cleanly by
            the window's own rounded corners via the parent's
            overflow-hidden. Percentages (not px) keep the same relative
            lean at every width.

            This has to sit ABOVE the light column's own background for the
            diagonal to actually read as a diagonal: the two are DOM
            siblings with no z-index, so without `z-10` here the later
            (lighter) column would simply paint over — and fully hide —
            whatever this layer paints past the 50% mark. The right column
            below is `lg:bg-transparent` for exactly this reason; the
            window's own `bg-surface` is what shows through it instead,
            everywhere this shape doesn't reach. Bottom of the gradient
            reuses the shared Footer's own `footer` token (see
            footer.tsx's `bg-gradient-to-b from-footer ...`) so this panel
            and the Footer read as the same navy family without physically
            touching or merging into it. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10 hidden bg-gradient-to-b from-primary-dark to-footer lg:block"
          style={{ clipPath: "polygon(0 0, 57% 0, 46% 100%, 0 100%)" }}
        />

        <div className="relative z-20 flex flex-col lg:min-h-[600px] lg:flex-row">
          {/* Left — brand panel. Solid navy gradient on mobile/tablet (its
              own background); cleared at lg+ so the diagonal layer above
              supplies it instead. `lg:bg-none`, not `lg:bg-transparent` —
              `bg-gradient-to-b` sets `background-image`, and Tailwind's
              `bg-transparent` only resets `background-color`, so it was
              leaving this column's own (same-colored, so invisible in the
              upper portion) gradient painted underneath at every width,
              silently flattening the diagonal's lower portion to a vertical
              edge wherever the true diagonal receded past this column's
              fixed 50% boundary. */}
          <div className="relative flex flex-col overflow-hidden bg-gradient-to-b from-primary-dark to-footer px-6 py-12 sm:px-10 lg:w-1/2 lg:bg-none lg:px-16 lg:py-14 xl:px-20 [@media(max-height:500px)]:py-6">
            <div className="flex flex-1 flex-col justify-center motion-safe:animate-[slide-up_450ms_ease-out_both] lg:-mt-4">
              <h1 className="max-w-[410px] text-3xl font-bold leading-tight text-white sm:text-4xl [@media(max-height:500px)]:text-2xl">
                Η διαδρομή σας ξεκινά από εδώ.
              </h1>
              <p className="mt-6 max-w-[420px] text-sm leading-relaxed text-white/70 sm:text-base [@media(max-height:500px)]:mt-3">
                Ανακαλύψτε το αυτοκίνητο που σας ταιριάζει και κάντε το επόμενο βήμα με μια σύγχρονη, απλή και
                αξιόπιστη εμπειρία Kinsen.
              </p>
            </div>
          </div>

          {/* Right — login card. Transparent at lg+ (see the diagonal layer's
              comment above) so it stops opaquely covering the diagonal's
              bleed past the 50% mark; the window's own bg-surface takes
              over as the light backdrop instead, an identical color so
              there's no seam between the two. */}
          <div className="relative flex flex-1 items-center justify-center bg-surface px-6 py-12 sm:px-10 lg:bg-transparent lg:px-16 [@media(max-height:500px)]:py-6">
            {/* Barely-there corporate depth — not decoration competing with
                the form, just enough to keep the panel from reading flat. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-16 right-6 h-64 w-64 rounded-full bg-accent/5 blur-3xl" />
              <div className="absolute bottom-0 left-10 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />
            </div>

            <div className="relative w-full max-w-[440px] motion-safe:animate-[slide-up_500ms_ease-out_120ms_both]">
              <Card className="border-border/70 shadow-card">
                <CardHeader className="p-6 pb-0 sm:p-8 sm:pb-0 [@media(max-height:500px)]:p-4 [@media(max-height:500px)]:pb-0">
                  <CardTitle className="text-2xl font-bold text-primary">Καλώς ήρθατε ξανά</CardTitle>
                  <p className="mt-1.5 text-sm text-ink-muted">Συνδεθείτε στον λογαριασμό σας</p>
                </CardHeader>
                <CardContent className="p-6 sm:p-8 [@media(max-height:500px)]:p-4">
                  <Suspense>
                    <LoginForm />
                  </Suspense>
                </CardContent>
              </Card>

              <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-ink-muted/80 [@media(max-height:500px)]:mt-3">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                Ασφάλεια δεδομένων
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
