import { requirePagePermission } from "@/lib/permissions";
import { getAllPageContent } from "@/server/services/content.service";
import type {
  HeroContent,
  StatsContent,
  HowItWorksContent,
  BenefitsContent,
  InfoHeroContent,
  InfoCardsContent,
} from "@/lib/content-defaults";
import {
  HeroEditor,
  StatsEditor,
  HowItWorksEditor,
  BenefitsEditor,
  InfoHeroEditor,
  InfoCardsEditor,
} from "@/components/admin/content-manager";

export const dynamic = "force-dynamic";

export default async function AdminContentPage() {
  await requirePagePermission("CONTENT_READ");
  const content = await getAllPageContent();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Περιεχόμενο Σελίδων</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Επεξεργαστείτε τα κείμενα των δημόσιων σελίδων. Οι αλλαγές εμφανίζονται άμεσα στο site.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Αρχική Σελίδα</h2>
        <HeroEditor initialValue={content["home.hero"] as HeroContent} />
        <StatsEditor initialValue={content["home.stats"] as StatsContent} />
        <HowItWorksEditor initialValue={content["home.howItWorks"] as HowItWorksContent} />
        <BenefitsEditor initialValue={content["home.benefits"] as BenefitsContent} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Δανειοδότηση</h2>
        <InfoHeroEditor sectionKey="financing.hero" label="Δανειοδότηση" initialValue={content["financing.hero"] as InfoHeroContent} />
        <InfoCardsEditor sectionKey="financing.cards" label="Δανειοδότηση" initialValue={content["financing.cards"] as InfoCardsContent} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Εγγύηση</h2>
        <InfoHeroEditor sectionKey="warranty.hero" label="Εγγύηση" initialValue={content["warranty.hero"] as InfoHeroContent} />
        <InfoCardsEditor sectionKey="warranty.cards" label="Εγγύηση" initialValue={content["warranty.cards"] as InfoCardsContent} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">Επικοινωνία</h2>
        <InfoHeroEditor sectionKey="contact.hero" label="Επικοινωνία" initialValue={content["contact.hero"] as InfoHeroContent} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-ink">FAQ</h2>
        <InfoHeroEditor sectionKey="faq.hero" label="FAQ" initialValue={content["faq.hero"] as InfoHeroContent} />
        <p className="text-sm text-ink-muted">
          Οι ίδιες οι ερωτήσεις/απαντήσεις διαχειρίζονται από τη σελίδα{" "}
          <a href="/admin/faq" className="text-primary underline">Διαχείριση FAQ</a>.
        </p>
      </section>
    </div>
  );
}
