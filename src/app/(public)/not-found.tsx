import type { Metadata } from "next";
import { GeneralNotFoundContent } from "@/components/status/general-not-found-content";

export const metadata: Metadata = {
  title: "Η σελίδα δεν βρέθηκε",
  robots: { index: false, follow: false },
};

// Catches notFound() calls thrown by any page inside the public route tree
// that doesn't have a more specific not-found.tsx of its own (the vehicle
// detail route has one — see vehicles/[slug]/not-found.tsx). Rendered as
// (public)/layout.tsx's `children`, so Header/Footer stay mounted for free.
export default function PublicNotFound() {
  return <GeneralNotFoundContent />;
}
