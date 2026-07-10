import type { Metadata } from "next";
import { InfoHero } from "@/components/info-page/info-hero";
import { InfoCardGrid, CardBody } from "@/components/info-page/info-card-grid";
import { getPageContent } from "@/server/services/content.service";

export const metadata: Metadata = {
  title: "Εγγύηση",
  description: "Απόλυτη σιγουριά με την Εγγύηση Kinsen. Καλύπτουμε τα σημαντικότερα μηχανικά μέρη για έως και 12 μήνες.",
  alternates: { canonical: "/warranty" },
};

export default async function WarrantyPage() {
  const hero = await getPageContent("warranty.hero");
  const { cards } = await getPageContent("warranty.cards");

  return (
    <div>
      <InfoHero image="/images/egguhsh.jpg" title={hero.title} subtitle={hero.subtitle} />
      <InfoCardGrid cards={cards.map((card) => ({ title: card.title, content: <CardBody text={card.body} /> }))} />
    </div>
  );
}
