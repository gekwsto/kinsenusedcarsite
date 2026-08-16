import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { getSiteSettings } from "@/server/services/settings.service";
import { CookieSettingsButton } from "@/components/layout/cookie-settings-button";
import { ScrambleLink } from "@/components/layout/scramble-link";

const NAV_LINKS = [
  { label: "Οχήματα", href: "/vehicles" },
  { label: "Δανειοδότηση", href: "/financing" },
  { label: "Εγγύηση", href: "/warranty" },
  { label: "Σύγκριση οχημάτων", href: "/compare" },
];

const COMPANY_LINKS = [
  { label: "Επικοινωνία", href: "/contact" },
  { label: "Συχνές Ερωτήσεις", href: "/faq" },
  { label: "Η Kinsen", href: "https://www.kinsen.gr", external: true },
];

// Rendered in the same scrambling-hover row as the social links — plain
// links, no "Συνεργάτες" heading/column of their own.
const PARTNER_LINKS = [
  { label: "Europcar", href: "https://www.europcar.com/en-us" },
  { label: "Goldcar", href: "https://www.goldcar.com/el-gr/" },
  { label: "Saracakis Leasing", href: "https://saracakisleasing.gr/" },
];

const SOCIAL_LINKS = (settings: Awaited<ReturnType<typeof getSiteSettings>>) => [
  { label: "Facebook", href: settings.socialLinks.facebook || "https://www.facebook.com/KinsenGR/" },
  { label: "Instagram", href: settings.socialLinks.instagram || "https://www.instagram.com/kinsen_hellas/" },
  { label: "LinkedIn", href: settings.socialLinks.linkedin || "https://gr.linkedin.com/company/kinsen" },
];

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-4 text-xs font-bold uppercase tracking-wider text-white/40">{title}</p>
      <ul className="space-y-2.5 text-sm text-white/75">{children}</ul>
    </div>
  );
}

export async function Footer() {
  const settings = await getSiteSettings();
  const year = new Date().getFullYear();
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;
  const scrambleRowLinks = [...SOCIAL_LINKS(settings), ...PARTNER_LINKS];

  return (
    // The top edge is a shallow clip-path dip (24px deep at its center,
    // flat again at both corners) replacing the previous hard straight
    // edge — a percentage-x / pixel-y polygon sampling a sine curve, so
    // it scales fluidly with the footer's width at every viewport
    // without needing per-breakpoint tuning (same technique as the
    // /login diagonal). The small pixel depth reveals a sliver of
    // whatever page content sits directly above the footer in that gap —
    // real footer content starts at `pt-14` (56px) below, well clear of
    // the curve. No separate top border/accent is layered on top of it;
    // the curve itself is the entire boundary treatment now.
    <footer
      // Non-visual observation target for the floating comparison
      // launcher's footer-aware auto-hide (see vehicle-comparison-tray.tsx's
      // useFooterVisible) — a stable, purpose-named selector rather than
      // reaching for the bare `<footer>` tag (which could collide with a
      // future nested `<footer>` elsewhere) or a CSS class (which could
      // change with a restyle). Carries no styling of its own.
      data-site-footer=""
      className="relative overflow-hidden bg-gradient-to-b from-footer via-[#031f30] to-[#00121e] text-white"
      style={{
        clipPath:
          "polygon(0% 0px, 5% 4px, 10% 7px, 15% 11px, 20% 14px, 25% 17px, 30% 19px, 35% 21px, 40% 23px, 45% 24px, 50% 24px, 55% 24px, 60% 23px, 65% 21px, 70% 19px, 75% 17px, 80% 14px, 85% 11px, 90% 7px, 95% 4px, 100% 0px, 100% 100%, 0% 100%)",
      }}
    >
      <div className="relative container-page pt-14 pb-10">
        <div className="grid grid-cols-1 gap-y-10 text-center sm:grid-cols-3 sm:text-left">
          <FooterColumn title="Πλοήγηση">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-white">
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Εταιρεία">
            {COMPANY_LINKS.map((link) =>
              link.external ? (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ) : (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ),
            )}
          </FooterColumn>

          <FooterColumn title="Επικοινωνία">
            <li className="text-white/75">
              <a
                href={mapsHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 transition-colors hover:text-white"
              >
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                {settings.address}
              </a>
            </li>
            <li>
              <a
                href={`mailto:${settings.contactEmail}`}
                className="inline-flex items-center gap-2 transition-colors hover:text-white"
              >
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                {settings.contactEmail}
              </a>
            </li>
            <li>
              <a
                href={`tel:${settings.contactPhone.replace(/\s+/g, "")}`}
                className="inline-flex items-center gap-2 transition-colors hover:text-white"
              >
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                {settings.contactPhone}
              </a>
            </li>
          </FooterColumn>
        </div>
      </div>

      {/* Full-bleed divider — deliberately outside container-page so it
          spans edge to edge rather than stopping at the content max-width. */}
      <div className="relative h-px w-full bg-white/10" />

      <div className="relative container-page py-8">
        {/* Social + partner row — spread across the width, every entry
            (social and partner alike) sharing the identical scramble
            hover/focus effect; no "Συνεργάτες" label, just plain links. */}
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {scrambleRowLinks.map((link) => (
            <ScrambleLink
              key={link.label}
              text={link.label.toUpperCase()}
              ariaLabel={link.label}
              href={link.href}
              external
              className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-white/70 transition-colors hover:text-white"
            />
          ))}
        </div>
      </div>

      {/* Full-bleed divider — same reasoning as the one above. */}
      <div className="relative h-px w-full bg-white/[0.07]" />

      <div className="relative container-page flex flex-col items-center justify-between gap-3 py-6 text-center sm:flex-row sm:text-left">
        <p className="text-xs text-white/40">© {year} Kinsen Hellas. All rights reserved.</p>
        <ul className="flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-xs text-white/60">
          <li>
            <Link href="/privacy-policy" className="transition-colors hover:text-white hover:underline">
              Πολιτική Προστασίας Δεδομένων
            </Link>
          </li>
          <li>
            <CookieSettingsButton className="transition-colors hover:text-white hover:underline" />
          </li>
        </ul>
      </div>

      {/* Purely decorative brand mark — the real Kinsen logo (same asset used
          in the transactional emails, see logoUrl() in
          lead-notification.service.ts), replacing the previous oversized
          "KINSEN" text wordmark. `clamp()` scales it continuously between a
          mobile floor and a desktop ceiling rather than jumping at fixed
          breakpoints, so it's correctly sized at every viewport width, not
          just the ones with an explicit rule. aria-hidden + pointer-events-none
          since it carries no information and must never intercept a click
          meant for real content. */}
      <div aria-hidden="true" className="pointer-events-none relative flex select-none justify-center pt-2 pb-6 sm:pb-8">
        <Image
          src="/images/kinsen_logowhite.png"
          alt=""
          width={3000}
          height={701}
          className="h-auto w-[clamp(11rem,40vw,26rem)] opacity-90"
        />
      </div>
    </footer>
  );
}
