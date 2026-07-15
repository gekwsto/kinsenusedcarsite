import Image from "next/image";
import { Mail, Phone, MapPin, Facebook, Instagram, Linkedin } from "lucide-react";
import { NavigationLink as Link } from "@/components/navigation/navigation-link";
import { getSiteSettings } from "@/server/services/settings.service";
import { CookieSettingsButton } from "@/components/layout/cookie-settings-button";

const GROUP_LINKS = [
  { label: "Europcar", href: "https://www.europcar.com/en-us" },
  { label: "Goldcar", href: "https://www.goldcar.com/el-gr/" },
  { label: "Saracakis Leasing", href: "https://saracakisleasing.gr/" },
];

const SOCIAL_LINKS = (settings: Awaited<ReturnType<typeof getSiteSettings>>) => [
  { icon: Facebook, label: "Facebook", href: settings.socialLinks.facebook || "https://www.facebook.com/KinsenGR/" },
  { icon: Instagram, label: "Instagram", href: settings.socialLinks.instagram || "https://www.instagram.com/kinsen_hellas/" },
  { icon: Linkedin, label: "LinkedIn", href: settings.socialLinks.linkedin || "https://gr.linkedin.com/company/kinsen" },
];

export async function Footer() {
  const settings = await getSiteSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="relative bg-footer text-center text-white lg:text-left">
      {/* A soft ambient accent instead of a hard edge into the page above —
          the one deliberate departure from the flat, dividerless look this
          replaces. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />

      <section className="flex justify-center gap-4 px-4 py-4 lg:justify-between">
        <div className="hidden lg:block" />
        <div className="flex items-center gap-3">
          <span className="mr-1 text-sm text-white/70">Βρείτε μας στα Social</span>
          {SOCIAL_LINKS(settings).map(({ icon: Icon, label, href }) => (
            <a
              key={label}
              href={href}
              aria-label={label}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/80 transition-all hover:-translate-y-0.5 hover:bg-accent/20 hover:text-accent"
            >
              <Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </section>

      <div className="h-px bg-white/[0.07]" />

      <section className="container-page py-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div>
            <div className="relative mb-4 h-[64px] w-[168px] mx-auto lg:mx-0">
              <Image src="/images/kinsen_logowhite.png" alt="Kinsen" fill sizes="168px" className="object-contain object-left" />
            </div>
            <p className="text-left text-sm leading-relaxed text-white/70">
              Η Kinsen, αποτελεί δημιούργημα και κοινό όραμα μιας ομάδας Ευρωπαίων ιδιωτών επενδυτών και μιας
              ελληνικής οικογένειας, με μακρόχρονη παρουσία στο ελληνικό επιχειρείν.
            </p>
            <a
              href="https://www.kinsen.gr"
              target="_blank"
              rel="noreferrer"
              className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent transition-colors hover:text-white"
            >
              Μπείτε στη σελίδα της Kinsen
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
            </a>
          </div>

          <div>
            <p className="mb-4 text-xs font-bold uppercase tracking-wider text-accent">Επικοινωνία</p>
            <ul className="space-y-3 text-left text-sm text-white/80">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                  <MapPin className="h-3.5 w-3.5" />
                </span>
                <span className="pt-1">{settings.address}</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                  <Mail className="h-3.5 w-3.5" />
                </span>
                <a href={`mailto:${settings.contactEmail}`} className="transition-colors hover:text-white">
                  {settings.contactEmail}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                  <Phone className="h-3.5 w-3.5" />
                </span>
                <a href={`tel:${settings.contactPhone.replace(/\s+/g, "")}`} className="transition-colors hover:text-white">
                  {settings.contactPhone}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="h-px bg-white/[0.07]" />

      <div className="px-4 py-6 text-center">
        <ul className="flex list-none flex-wrap items-center justify-center gap-3">
          {GROUP_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-block rounded-full border border-white/10 px-4 py-1.5 text-sm font-medium text-white/75 transition-colors hover:border-accent/40 hover:text-accent"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="h-px bg-white/[0.07]" />

      <div className="px-4 py-5 text-center">
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
        <p className="mt-3 text-xs text-white/40">© {year} Kinsen Hellas. All rights reserved.</p>
      </div>
    </footer>
  );
}
