export interface RekognitionLabel {
  name: string;
  confidence: number;
}

export interface NormalizedTag {
  name: string;
  originalLabel: string;
  confidence: number;
}

export interface DerivedCategory {
  name: string;
  score: number;
}

const ALIASES: Record<string, string> = {
  "outer space": "space", astronomy: "space", galaxy: "space",
  "mountain range": "mountain", peak: "mountain",
  outdoors: "nature", forest: "nature", tree: "nature", plant: "nature",
  "starry sky": "stars", "cityscape": "city", urban: "city",
  "modern art": "art", graphics: "art", scenery: "landscape",
};

// These labels are useful detection context but are too generic to be useful tags.
const IGNORED = new Set([
  "adult", "person", "male", "female", "man", "woman", "head", "face",
  "body part", "outdoors", "lighting", "light", "sky", "photography",
  "image", "object", "thing", "indoor",
]);

type Rule = { tag: string; weight: number };
const RULES: Record<string, Rule[]> = {
  nature: ["nature", "landscape", "forest", "tree", "plant", "flower", "grass", "leaf", "cactus", "wilderness", "countryside", "desert"].map((tag) => ({ tag, weight: tag === "nature" ? 1.2 : 1 })),
  space: ["space", "stars", "moon", "nebula", "aurora", "sun", "sunset", "night"].map((tag) => ({ tag, weight: tag === "space" ? 1.3 : 1 })),
  mountain: ["mountain", "rock", "peak"].map((tag) => ({ tag, weight: tag === "mountain" ? 1.3 : 1 })),
  dark: ["night", "black", "dark", "silhouette", "shadow"].map((tag) => ({ tag, weight: tag === "night" ? 1.2 : 1 })),
  art: ["art", "painting", "pattern", "fractal", "ornament", "texture", "drawing", "sticker", "cartoon"].map((tag) => ({ tag, weight: tag === "art" ? 1.2 : 1 })),
  architecture: ["architecture", "building", "home decor", "wall", "brick"].map((tag) => ({ tag, weight: tag === "architecture" ? 1.2 : 1 })),
  city: ["city", "urban", "metropolis", "cityscape", "street", "road"].map((tag) => ({ tag, weight: tag === "city" ? 1.2 : 1 })),
  water: ["water", "sea", "ocean", "river", "lake", "ripple", "wave"].map((tag) => ({ tag, weight: tag === "water" ? 1.2 : 1 })),
  minimal: ["minimal", "simple", "plain"].map((tag) => ({ tag, weight: 1 })),
};

export function normalizeLabel(label: string): string {
  const cleaned = label.trim().toLowerCase().replace(/\s+/g, " ");
  return ALIASES[cleaned] ?? cleaned;
}

export function normalizeLabels(labels: RekognitionLabel[]): NormalizedTag[] {
  const tags = new Map<string, NormalizedTag>();
  for (const label of labels) {
    if (!label || typeof label.name !== "string" || typeof label.confidence !== "number") continue;
    const originalLabel = label.name.trim();
    const confidence = Math.round(label.confidence * 100) / 100;
    if (!originalLabel || !Number.isFinite(confidence) || confidence < 60) continue;
    const name = normalizeLabel(originalLabel);
    if (IGNORED.has(name) || !name) continue;
    const existing = tags.get(name);
    if (!existing || confidence > existing.confidence) tags.set(name, { name, originalLabel, confidence });
  }
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function deriveCategories(tags: NormalizedTag[]): { categories: DerivedCategory[]; primaryCategory: string | null } {
  const scores = new Map<string, number>();
  for (const tag of tags) {
    const normalized = normalizeLabel(tag.name);
    for (const [category, rules] of Object.entries(RULES)) {
      const rule = rules.find((candidate) => normalized === normalizeLabel(candidate.tag));
      if (rule) scores.set(category, (scores.get(category) ?? 0) + tag.confidence * rule.weight);
    }
  }
  const categories = [...scores.entries()].map(([name, score]) => ({ name, score: Math.round(score * 100) / 100 })).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return { categories, primaryCategory: categories[0]?.name ?? null };
}
