import { prisma } from "@/lib/prisma";

const GREEK_TO_LATIN: Record<string, string> = {
  ά: "a", α: "a", έ: "e", ε: "e", ή: "i", η: "i", ί: "i", ϊ: "i", ΐ: "i", ι: "i",
  ό: "o", ο: "o", ύ: "y", ϋ: "y", ΰ: "y", υ: "y", ώ: "o", ω: "o",
  β: "v", γ: "g", δ: "d", ζ: "z", θ: "th", κ: "k", λ: "l", μ: "m", ν: "n",
  ξ: "x", π: "p", ρ: "r", σ: "s", ς: "s", τ: "t", φ: "f", χ: "ch", ψ: "ps",
};

function transliterate(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => GREEK_TO_LATIN[char] ?? char)
    .join("");
}

export function slugify(input: string): string {
  return transliterate(input)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function buildVehicleSlugBase(params: {
  maker: string;
  model: string;
  yearRelease?: number | null;
}): string {
  const parts = [params.maker, params.model, params.yearRelease ?? undefined]
    .filter(Boolean)
    .map(String);
  return slugify(parts.join("-"));
}

export async function generateUniqueVehicleSlug(
  params: { maker: string; model: string; yearRelease?: number | null },
  excludeId?: string,
): Promise<string> {
  const base = buildVehicleSlugBase(params) || "vehicle";
  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.vehicle.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}
