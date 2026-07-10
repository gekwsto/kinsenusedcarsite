import type { Metadata } from "next";
import { InfoHero } from "@/components/info-page/info-hero";
import { InfoCardGrid, CardBody } from "@/components/info-page/info-card-grid";
import { getPageContent } from "@/server/services/content.service";

export const metadata: Metadata = {
  title: "Δανειοδότηση",
  description: "Αποκτήστε το επόμενο σας αυτοκίνητο με ευέλικτη δανειοδότηση, σταθερό επιτόκιο 7% και αποπληρωμή έως 48 μήνες.",
  alternates: { canonical: "/financing" },
};

export default async function FinancingPage() {
  const hero = await getPageContent("financing.hero");
  const { cards } = await getPageContent("financing.cards");

  return (
    <div>
      <InfoHero image="/images/keys.jpg" title={hero.title} subtitle={hero.subtitle} />
      <InfoCardGrid cards={cards.map((card) => ({ title: card.title, content: <CardBody text={card.body} /> }))} />
    </div>
  );
}
