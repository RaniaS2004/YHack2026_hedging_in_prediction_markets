// Hardcoded correlation mappings when Grok is unavailable.
// Maps risk keywords to market categories + recommended sides.

interface FallbackMapping {
  keywords: string[];
  targetCategories: string[];
  defaultSide: "YES" | "NO";
  correlationStrength: number;
}

const FALLBACK_MAPPINGS: FallbackMapping[] = [
  {
    keywords: ["tariff", "trade war", "import", "export", "sanction", "auto importer"],
    targetCategories: ["trade"],
    defaultSide: "YES",
    correlationStrength: 0.7,
  },
  {
    keywords: ["bitcoin", "btc", "long btc"],
    targetCategories: ["crypto"],
    defaultSide: "NO",
    correlationStrength: 0.6,
  },
  {
    keywords: ["ethereum", "eth", "long eth"],
    targetCategories: ["crypto"],
    defaultSide: "NO",
    correlationStrength: 0.6,
  },
  {
    keywords: ["solana", "sol", "long sol"],
    targetCategories: ["crypto"],
    defaultSide: "NO",
    correlationStrength: 0.55,
  },
  {
    keywords: ["recession", "downturn", "bear market", "crash"],
    targetCategories: ["economics"],
    defaultSide: "YES",
    correlationStrength: 0.65,
  },
  {
    keywords: ["inflation", "cpi", "prices rising"],
    targetCategories: ["economics"],
    defaultSide: "YES",
    correlationStrength: 0.6,
  },
  {
    keywords: ["election", "trump", "biden", "political"],
    targetCategories: ["politics"],
    defaultSide: "YES",
    correlationStrength: 0.5,
  },
  {
    keywords: ["iran", "oil", "crude", "middle east", "geopolitical", "war", "conflict"],
    targetCategories: ["politics", "economics"],
    defaultSide: "YES",
    correlationStrength: 0.68,
  },
  {
    keywords: ["ai regulation", "tech regulation"],
    targetCategories: ["tech"],
    defaultSide: "YES",
    correlationStrength: 0.55,
  },
];

export function getFallbackRecommendations(
  description: string
): { targetCategories: string[]; defaultSide: "YES" | "NO"; correlationStrength: number } | null {
  const lower = description.toLowerCase();

  for (const mapping of FALLBACK_MAPPINGS) {
    if (mapping.keywords.some((kw) => lower.includes(kw))) {
      return {
        targetCategories: mapping.targetCategories,
        defaultSide: mapping.defaultSide,
        correlationStrength: mapping.correlationStrength,
      };
    }
  }

  return null;
}
