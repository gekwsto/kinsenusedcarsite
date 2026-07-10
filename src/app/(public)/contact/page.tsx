import type { Metadata } from "next";
import Image from "next/image";
import { ContactForm } from "@/components/forms/contact-form";
import { getPageContent } from "@/server/services/content.service";

export const metadata: Metadata = {
  title: "Επικοινωνία",
  description: "Επικοινωνήστε με την ομάδα της Kinsen για μεταχειρισμένα οχήματα, leasing και δανειοδότηση.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const hero = await getPageContent("contact.hero");

  return (
    <div className="container-page py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-primary sm:text-3xl">{hero.title}</h1>
        <h2 className="mt-2 text-base font-normal text-ink-muted sm:text-lg">{hero.subtitle}</h2>
      </div>

      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-lg">
          <Image
            src="/images/communication.jpg"
            alt="Επικοινωνία"
            fill
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>

        <div>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
