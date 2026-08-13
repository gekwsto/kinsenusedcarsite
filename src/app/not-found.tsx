import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GeneralNotFoundContent } from "@/components/status/general-not-found-content";

export const metadata: Metadata = {
  title: "Η σελίδα δεν βρέθηκε",
  robots: { index: false, follow: false },
};

// Next.js always resolves a URL that matches no route at all against the
// root app/not-found.tsx, regardless of route groups (verified: a
// (public)/not-found.tsx alone did NOT catch a fully unmatched URL like
// /this-page-does-not-exist — the framework's default dark fallback still
// rendered). This file is the one that actually replaces that default.
//
// It renders outside (public)/layout.tsx, so the real Header/Footer aren't
// available here — both throw without FavoritesProvider/CookieConsentProvider,
// which only that layout mounts. Rather than reproduce that whole provider
// tree just for a 404, this renders a minimal, dependency-free branded
// header (logo only) instead, keeping the page reliable while still
// visibly a Kinsen page. The actual 404 content is identical to
// (public)/not-found.tsx via the shared GeneralNotFoundContent.
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border bg-white">
        <div className="container-page flex h-16 items-center">
          <Link href="/" aria-label="Αρχική" className="relative h-10 w-32">
            <Image
              src="/images/brandlogo.png"
              alt="Kinsen Hellas"
              fill
              sizes="128px"
              className="object-contain object-left"
              priority
            />
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col">
        <GeneralNotFoundContent />
      </main>
    </div>
  );
}
