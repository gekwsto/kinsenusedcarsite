import type { Metadata } from "next";
import { Hero } from "@/components/home/hero";
import { StatsParagraph } from "@/components/home/stats-paragraph";
import { CategoryLinks } from "@/components/home/category-links";
import { FeaturedVehicles } from "@/components/home/featured-vehicles";
import { HowItWorks } from "@/components/home/how-it-works";
import { Benefits } from "@/components/home/benefits";

export const metadata: Metadata = {
  title: "Αρχική",
  description: "Μεταχειρισμένα αυτοκίνητα με leasing από την Kinsen Hellas. Βρείτε το επόμενο αυτοκίνητό σας με ευέλικτο leasing και δανειοδότηση.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsParagraph />
      <CategoryLinks />
      <FeaturedVehicles />
      <HowItWorks />
      <Benefits />
    </>
  );
}
