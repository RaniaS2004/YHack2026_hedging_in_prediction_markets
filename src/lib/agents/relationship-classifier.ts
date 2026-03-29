import { openai, OPENAI_MODEL } from "../llm/client";
import { NormalizedMarket, MarketMatch, MarketRelationship } from "@/types";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

const BATCH_SIZE = 10;
const MATCH_CONFIDENCE_THRESHOLD = 0.6;
const TEXT_SIMILARITY_THRESHOLD = 0.25; // Pre-filter: only send pairs above this to LLM

// ─── Text similarity pre-filter ───────────────────────────────────────────────
// Fast keyword-based similarity that catches differently-worded identical events
// BEFORE sending to the LLM. This is the key to both accuracy and latency.

/** Stop words to ignore in similarity calculation */
const STOP_WORDS = new Set([
  "will", "the", "a", "an", "be", "by", "in", "on", "of", "to", "is", "it",
  "at", "or", "and", "for", "this", "that", "has", "have", "was", "are",
  "with", "from", "its", "does", "do", "can", "than", "before", "after",
  "above", "below", "more", "less", "over", "under", "between",
  "during", "through", "about", "into", "any", "each", "what", "when",
  "which", "who", "how", "if", "not", "no", "yes", "his", "her", "their",
  "would", "could", "should", "may", "might", "shall",
]);

/** Synonyms and aliases for entity normalization */
const ENTITY_ALIASES: Record<string, string> = {
  btc: "bitcoin", bitcoin: "bitcoin",
  eth: "ethereum", ethereum: "ethereum",
  sol: "solana", solana: "solana",
  "100k": "100000", "100,000": "100000", "100000": "100000",
  "50k": "50000", "50,000": "50000", "50000": "50000",
  "75k": "75000", "75,000": "75000", "75000": "75000",
  "150k": "150000", "150,000": "150000", "150000": "150000",
  "200k": "200000", "200,000": "200000", "200000": "200000",
  trump: "trump", donald: "trump",
  biden: "biden", joe: "biden",
  fed: "fed", "federal reserve": "fed",
  elon: "musk", musk: "musk",
  "q1": "q1", "q2": "q2", "q3": "q3", "q4": "q4",
  january: "jan", jan: "jan", february: "feb", feb: "feb",
  march: "mar", mar: "mar", april: "apr", apr: "apr",
  may: "may", june: "jun", jun: "jun", july: "jul", jul: "jul",
  august: "aug", aug: "aug", september: "sep", sep: "sep",
  october: "oct", oct: "oct", november: "nov", nov: "nov",
  december: "dec", dec: "dec",
  "2024": "2024", "2025": "2025", "2026": "2026",
  recession: "recession", gdp: "gdp", inflation: "inflation",
  tariff: "tariff", tariffs: "tariff",
  election: "election", elections: "election",
  president: "president", presidential: "president",
  "s&p": "sp500", "sp500": "sp500", "s&p500": "sp500", "s&p 500": "sp500",
  nasdaq: "nasdaq", "qqq": "nasdaq",
  war: "war", conflict: "war", invasion: "war",
  ukraine: "ukraine", russia: "russia", china: "china", israel: "israel",
  rate: "rate", rates: "rate", "interest rate": "rate",
  "rate cut": "rate_cut", "rate hike": "rate_hike",
  cease: "ceasefire", ceasefire: "ceasefire",
  nuclear: "nuclear", nuke: "nuclear",
  pope: "pope", vatican: "pope",
};

/**
 * Tokenize and normalize a market title for similarity comparison.
 * Extracts meaningful keywords, resolves aliases, preserves numbers.
 */
function tokenize(title: string): Set<string> {
  const lower = title.toLowerCase().replace(/['']/g, "'");
  // Extract numbers (including dollar amounts, percentages)
  const numbers = lower.match(/\$?[\d,]+\.?\d*%?/g) || [];
  // Extract words
  const words = lower.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);

  const tokens = new Set<string>();

  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    // Apply alias normalization
    const alias = ENTITY_ALIASES[word];
    tokens.add(alias || word);
  }

  // Add normalized numbers
  for (const num of numbers) {
    const clean = num.replace(/[$,%]/g, "").replace(/,/g, "");
    const alias = ENTITY_ALIASES[clean];
    tokens.add(alias || clean);
    // Also add the raw number for exact matching
    if (clean !== num) tokens.add(clean);
  }

  return tokens;
}

/**
 * Compute similarity between two market titles.
 * Uses weighted Jaccard with bonuses for shared entities and numbers.
 */
function titleSimilarity(titleA: string, titleB: string): number {
  const tokensA = tokenize(titleA);
  const tokensB = tokenize(titleB);

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  // Jaccard similarity
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = intersection / union;

  // Bonus for shared numbers (strong signal for same event)
  const numbersA = new Set([...tokensA].filter((t) => /^\d+\.?\d*$/.test(t)));
  const numbersB = new Set([...tokensB].filter((t) => /^\d+\.?\d*$/.test(t)));
  let numberBonus = 0;
  for (const n of numbersA) {
    if (numbersB.has(n)) numberBonus += 0.15;
  }

  // Bonus for shared named entities (people, assets, countries)
  const entityValues = new Set(Object.values(ENTITY_ALIASES));
  const entitiesA = new Set([...tokensA].filter((t) => entityValues.has(t)));
  const entitiesB = new Set([...tokensB].filter((t) => entityValues.has(t)));
  let entityBonus = 0;
  for (const e of entitiesA) {
    if (entitiesB.has(e)) entityBonus += 0.1;
  }

  return Math.min(1, jaccard + numberBonus + entityBonus);
}

// ─── LLM Classification Schema ───────────────────────────────────────────────

const MarketPairClassificationSchema = z.object({
  pairs: z.array(
    z.object({
      indexA: z.number(),
      indexB: z.number(),
      isSameEvent: z.boolean(),
      sameEventConfidence: z.number().min(0).max(1),
      relationship: z.enum([
        "SAME_EVENT",
        "MUTUALLY_EXCLUSIVE",
        "POSITIVELY_CORRELATED",
        "NEGATIVELY_CORRELATED",
        "CONDITIONAL",
        "INDEPENDENT",
      ]),
      reasoning: z.string(),
    })
  ),
});

type ClassificationResult = z.infer<typeof MarketPairClassificationSchema>;

// ─── Pair Generation ──────────────────────────────────────────────────────────

/**
 * Generate cross-platform pairs using text similarity pre-filter.
 * Only pairs markets from DIFFERENT platforms.
 * Returns pairs sorted by text similarity (highest first).
 */
export function generateCrossPlatformPairs(
  markets: NormalizedMarket[]
): Array<{ pair: [NormalizedMarket, NormalizedMarket]; textSim: number }> {
  // Group by platform
  const byPlatform = new Map<string, NormalizedMarket[]>();
  for (const m of markets) {
    if (m.resolved) continue;
    const arr = byPlatform.get(m.platform) || [];
    arr.push(m);
    byPlatform.set(m.platform, arr);
  }

  const platforms = Array.from(byPlatform.keys());
  const scoredPairs: Array<{
    pair: [NormalizedMarket, NormalizedMarket];
    textSim: number;
  }> = [];

  // Compare every market across platforms using text similarity
  for (let pi = 0; pi < platforms.length; pi++) {
    for (let pj = pi + 1; pj < platforms.length; pj++) {
      const marketsA = byPlatform.get(platforms[pi])!;
      const marketsB = byPlatform.get(platforms[pj])!;

      for (const a of marketsA) {
        for (const b of marketsB) {
          const sim = titleSimilarity(a.title, b.title);
          if (sim >= TEXT_SIMILARITY_THRESHOLD) {
            scoredPairs.push({ pair: [a, b], textSim: sim });
          }
        }
      }
    }
  }

  // Sort by similarity descending
  scoredPairs.sort((a, b) => b.textSim - a.textSim);

  return scoredPairs;
}

// ─── LLM Batch Classification ─────────────────────────────────────────────────

/**
 * Classify market pairs using OpenAI in batches.
 * Returns MarketMatch objects for pairs with meaningful relationships.
 */
export async function classifyMarketPairs(
  pairs: Array<{ pair: [NormalizedMarket, NormalizedMarket]; textSim: number }>
): Promise<MarketMatch[]> {
  const matches: MarketMatch[] = [];

  // Process in batches
  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);

    try {
      const result = await classifyBatch(
        batch.map((p) => p.pair)
      );
      if (!result) continue;

      for (const classified of result.pairs) {
        if (classified.relationship === "INDEPENDENT") continue;
        if (
          classified.sameEventConfidence < MATCH_CONFIDENCE_THRESHOLD &&
          !classified.isSameEvent
        )
          continue;

        const batchPair = batch[classified.indexA];
        if (!batchPair) continue;
        const [marketA, marketB] = batchPair.pair;

        matches.push({
          id: `${marketA.id}-${marketB.id}`,
          marketAId: marketA.id,
          marketAPlatform: marketA.platform,
          marketATitle: marketA.title,
          marketBId: marketB.id,
          marketBPlatform: marketB.platform,
          marketBTitle: marketB.title,
          matchConfidence: classified.sameEventConfidence,
          relationship: classified.relationship as MarketRelationship,
          reasoning: classified.reasoning,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      }
    } catch (err) {
      console.warn(`[Classifier] Batch ${i / BATCH_SIZE} failed:`, err);
    }
  }

  return matches;
}

async function classifyBatch(
  batch: Array<[NormalizedMarket, NormalizedMarket]>,
  retries = 1
): Promise<ClassificationResult | null> {
  const pairDescriptions = batch
    .map(
      ([a, b], idx) =>
        `${idx}: "${a.title}" (${a.platform}, $${a.yesPrice.toFixed(2)}) vs "${b.title}" (${b.platform}, $${b.yesPrice.toFixed(2)})`
    )
    .join("\n");

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const completion = await openai.chat.completions.parse({
        model: OPENAI_MODEL,
        max_tokens: 2048,
        messages: [
          {
            role: "system",
            content: `Classify prediction market pairs. Focus on whether they resolve to the same real-world outcome, even if worded differently.

SAME_EVENT: Same outcome (e.g. "BTC above $100k" vs "Bitcoin reach $100,000"). Set confidence >0.8.
MUTUALLY_EXCLUSIVE: If A→YES then B→NO.
POSITIVELY_CORRELATED: Tend to resolve same way.
NEGATIVELY_CORRELATED: A YES → B likely NO.
CONDITIONAL: B depends on A.
INDEPENDENT: No relationship.

indexA = pair index (0-based). 1 sentence max reasoning.`,
          },
          {
            role: "user",
            content: `Classify these ${batch.length} pairs:\n${pairDescriptions}`,
          },
        ],
        response_format: zodResponseFormat(
          MarketPairClassificationSchema,
          "market_pair_classification"
        ),
      });

      return completion.choices[0]?.message?.parsed ?? null;
    } catch (err) {
      if (attempt < retries) {
        console.warn(
          `[Classifier] Attempt ${attempt + 1} failed, retrying...`
        );
        continue;
      }
      throw err;
    }
  }
  return null;
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

/**
 * Run the full classification pipeline:
 * 1. Generate ALL cross-platform pairs
 * 2. Pre-filter by text similarity (fast, no LLM)
 * 3. Send only high-similarity pairs to OpenAI for confirmation
 * 4. Auto-match very high similarity pairs without LLM
 */
export async function classifyAllMarkets(
  markets: NormalizedMarket[]
): Promise<MarketMatch[]> {
  const startTime = Date.now();

  // Step 1: Generate pairs with text similarity scores
  const scoredPairs = generateCrossPlatformPairs(markets);
  console.log(
    `[Classifier] ${scoredPairs.length} pairs above similarity threshold (from ${markets.length} markets)`
  );

  if (scoredPairs.length === 0) return [];

  // Step 2: Auto-match very high similarity pairs (>0.7) without LLM
  const autoMatches: MarketMatch[] = [];
  const needsLLM: typeof scoredPairs = [];

  for (const sp of scoredPairs) {
    if (sp.textSim >= 0.7) {
      // High confidence text match — auto-classify as SAME_EVENT
      const [a, b] = sp.pair;
      autoMatches.push({
        id: `${a.id}-${b.id}`,
        marketAId: a.id,
        marketAPlatform: a.platform,
        marketATitle: a.title,
        marketBId: b.id,
        marketBPlatform: b.platform,
        marketBTitle: b.title,
        matchConfidence: Math.min(0.95, sp.textSim),
        relationship: "SAME_EVENT",
        reasoning: `High text similarity (${(sp.textSim * 100).toFixed(0)}%) — auto-matched`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      });
    } else {
      needsLLM.push(sp);
    }
  }

  console.log(
    `[Classifier] Auto-matched ${autoMatches.length} pairs, ${needsLLM.length} need LLM`
  );

  // Step 3: Send remaining pairs to LLM (cap at 40 to keep fast)
  const cappedForLLM = needsLLM.slice(0, 40);
  if (needsLLM.length > 40) {
    console.log(
      `[Classifier] Capped LLM pairs from ${needsLLM.length} to 40`
    );
  }

  const llmMatches =
    cappedForLLM.length > 0 ? await classifyMarketPairs(cappedForLLM) : [];

  const allMatches = [...autoMatches, ...llmMatches];
  const elapsed = Date.now() - startTime;
  console.log(
    `[Classifier] Done in ${elapsed}ms — ${allMatches.length} relationships (${autoMatches.length} auto + ${llmMatches.length} LLM)`
  );

  return allMatches;
}
