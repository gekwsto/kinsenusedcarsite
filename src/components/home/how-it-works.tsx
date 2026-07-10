import { CarFront, FileText, File, FileCheck2, Key } from "lucide-react";
import { getPageContent } from "@/server/services/content.service";

const STEP_ICONS = [CarFront, FileText, File, FileCheck2, Key];

export async function HowItWorks() {
  const content = await getPageContent("home.howItWorks");

  return (
    <section className="bg-[#f4f4f4] px-4 pb-16 pt-20">
      <div className="container-page">
        <div className="mb-12 text-center">
          <h2 className="mb-2 text-2xl font-extrabold text-navy sm:text-3xl">{content.heading}</h2>
          <p className="text-ink-muted">{content.subtitle}</p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {content.steps.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? CarFront;
            return (
              <div key={step.title} className="text-center">
                <div className="relative mx-auto mb-5 flex h-[58px] w-[58px] items-center justify-center rounded-xl bg-navy">
                  <Icon className="h-6 w-6 text-white" />
                  <span className="absolute -right-2.5 -top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mb-1.5 text-sm font-extrabold text-accent">{step.title}</h3>
                <p className="mx-auto max-w-[210px] text-sm leading-relaxed text-navy">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
