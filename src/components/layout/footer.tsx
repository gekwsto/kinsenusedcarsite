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

export async function Footer() {
  const settings = await getSiteSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-footer text-center text-white lg:text-left">
      <section className="flex justify-center gap-4 p-4 lg:justify-between">
        <div className="hidden lg:block" />
        <div className="flex items-center gap-4">
          <span className="mr-2 text-white/90">Βρείτε μας στα Social:</span>
          <a
            href={settings.socialLinks.facebook || "https://www.facebook.com/KinsenGR/"}
            aria-label="Facebook"
            className="text-white/90 hover:text-accent"
          >
            <Facebook className="h-4 w-4" />
          </a>
          <a
            href={settings.socialLinks.instagram || "https://www.instagram.com/kinsen_hellas/"}
            aria-label="Instagram"
            className="text-white/90 hover:text-accent"
          >
            <Instagram className="h-4 w-4" />
          </a>
          <a
            href={settings.socialLinks.linkedin || "https://gr.linkedin.com/company/kinsen"}
            aria-label="LinkedIn"
            className="text-white/90 hover:text-accent"
          >
            <Linkedin className="h-4 w-4" />
          </a>
        </div>
      </section>

      <section className="container-page mt-5">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="mb-4">
            <div className="relative mb-4 h-[70px] w-[180px]">
              <Image src="/images/kinsen_logowhite.png" alt="Kinsen" fill sizes="180px" className="object-contain object-left" />
            </div>
            <p className="text-left text-sm text-white/90">
              Η Kinsen, αποτελεί δημιούργημα και κοινό όραμα μιας ομάδας Ευρωπαίων ιδιωτών επενδυτών και μιας
              ελληνικής οικογένειας, με μακρόχρονη παρουσία στο ελληνικό επιχειρείν.
              <br />
              <a
                href="https://www.kinsen.gr"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block font-semibold text-accent hover:underline"
              >
                Μπείτε στη σελίδα της Kinsen →
              </a>
            </p>
          </div>

          <div className="mb-4">
            <p className="mb-4 font-bold text-accent">Επικοινωνία</p>
            <ul className="space-y-2 text-left text-sm text-white/90">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{settings.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <a href={`mailto:${settings.contactEmail}`} className="hover:text-white">
                  {settings.contactEmail}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <a href={`tel:${settings.contactPhone.replace(/\s+/g, "")}`} className="hover:text-white">
                  {settings.contactPhone}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div className="p-4 text-center">
        <ul className="flex list-none flex-wrap items-center justify-center gap-8 opacity-90">
          {GROUP_LINKS.map((link) => (
            <li key={link.label}>
              <a href={link.href} target="_blank" rel="noreferrer" className="text-sm font-semibold text-white/90 hover:text-accent">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <ul className="mt-4 flex list-none flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-xs text-white/80">
          <li>
            <Link href="/privacy-policy" className="hover:text-white hover:underline">
              Πολιτική Προστασίας Δεδομένων
            </Link>
          </li>
          <li>
            <CookieSettingsButton className="hover:text-white hover:underline" />
          </li>
        </ul>
        <p className="mt-4 text-xs text-white/70">© {year} Kinsen Hellas. All rights reserved.</p>
      </div>
    </footer>
  );
}
