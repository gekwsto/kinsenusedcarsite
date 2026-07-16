import Image from "next/image";
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
    <footer className="relative overflow-hidden bg-gradient-to-b from-footer via-[#031f30] to-[#00121e] text-white">
      {/* A soft ambient accent instead of a hard edge into the page above. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      {/* Atmospheric glow behind the lower half of the footer — the same
          teal already used everywhere on the site as the brand accent,
          just given room to breathe here instead of a flat solid fill. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[480px] bg-[radial-gradient(ellipse_60%_100%_at_50%_100%,rgba(57,192,195,0.16),transparent_70%)]" />

      <div className="relative container-page pt-14 pb-10">
        <div className="grid grid-cols-1 gap-y-10 text-center sm:grid-cols-3 sm:text-left">
          <FooterColumn title="Πλοήγηση">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="transition-colors hover:text-accent">
                  {link.label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Εταιρεία">
            {COMPANY_LINKS.map((link) =>
              link.external ? (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">
                    {link.label}
                  </a>
                </li>
              ) : (
                <li key={link.href}>
                  <Link href={link.href} className="transition-colors hover:text-accent">
                    {link.label}
                  </Link>
                </li>
              ),
            )}
          </FooterColumn>

          <FooterColumn title="Επικοινωνία">
            <li className="text-white/75">
              <a href={mapsHref} target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">
                {settings.address}
              </a>
            </li>
            <li>
              <a href={`mailto:${settings.contactEmail}`} className="transition-colors hover:text-accent">
                {settings.contactEmail}
              </a>
            </li>
            <li>
              <a href={`tel:${settings.contactPhone.replace(/\s+/g, "")}`} className="transition-colors hover:text-accent">
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
              className="font-mono text-xs font-bold uppercase tracking-[0.08em] text-white/70 transition-colors hover:text-accent"
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
