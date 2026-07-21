import { z } from "zod";
import type { ContentKey } from "@/lib/content-defaults";

const heroSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().min(1),
  subtitle: z.string().min(1),
  image: z.string().min(1),
});
const statsSchema = z.object({
  heading: z.string().min(1),
  paragraph1: z.string().min(1),
  paragraph2: z.string().min(1),
});
const howItWorksSchema = z.object({
  heading: z.string().min(1),
  subtitle: z.string().min(1),
  steps: z.array(z.object({ title: z.string().min(1), description: z.string().min(1) })).length(5),
});
const benefitsSchema = z.object({
  cards: z.array(z.object({ title: z.string().min(1), description: z.string().min(1), image: z.string().min(1) })).length(3),
});
const infoHeroSchema = z.object({ title: z.string().min(1), subtitle: z.string(), image: z.string().min(1) });
const infoCardsSchema = z.object({
  cards: z.array(z.object({ title: z.string().min(1), body: z.string().min(1) })).min(1),
});

export const CONTENT_SCHEMAS: Record<ContentKey, z.ZodTypeAny> = {
  "home.hero": heroSchema,
  "home.stats": statsSchema,
  "home.howItWorks": howItWorksSchema,
  "home.benefits": benefitsSchema,
  "financing.hero": infoHeroSchema,
  "financing.cards": infoCardsSchema,
  "warranty.hero": infoHeroSchema,
  "warranty.cards": infoCardsSchema,
  "contact.hero": infoHeroSchema,
  "faq.hero": infoHeroSchema,
};
