import type { Metadata } from "next";
import { InfoHero } from "@/components/info-page/info-hero";
import { InfoCardGrid } from "@/components/info-page/info-card-grid";
import { listActiveFaqItems } from "@/server/services/faq.service";
import { getPageContent } from "@/server/services/content.service";

export const metadata: Metadata = {
  title: "Συχνές Ερωτήσεις",
  description: "Απαντήσεις στις πιο συχνές ερωτήσεις για leasing, δανειοδότηση, εγγύηση και τη διαδικασία αγοράς στην Kinsen.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const items = await listActiveFaqItems();
  const hero = await getPageContent("faq.hero");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <InfoHero image="/images/faq.png" title={hero.title} subtitle={hero.subtitle || undefined} />
      <InfoCardGrid cards={items.map((item) => ({ title: item.question, content: <p>{item.answer}</p> }))} />
    </div>
  );
}
