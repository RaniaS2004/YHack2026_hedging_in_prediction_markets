import { NormalizedMarket, SpreadRow, MarketMatch, Platform } from "@/types";
import { fetchPolymarketMarkets } from "./polymarket";
import { fetchKalshiMarkets } from "./kalshi";
import { fetchLimitlessMarkets } from "./limitless";
import { getSampleMarkets } from "./sample-markets";

// In-memory cache with 5-min TTL
let cachedMarkets: NormalizedMarket[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Lighter refresh cache — just prices, 15s TTL
let lastRefreshTimestamp = 0;
const REFRESH_TTL = 15 * 1000; // 15 seconds

export async function fetchAllMarkets(
  forceRefresh = false
): Promise<NormalizedMarket[]> {
  const now = Date.now();

  // If not forcing and cache is valid, return cached
  if (!forceRefresh && cachedMarkets && now - cacheTimestamp < CACHE_TTL) {
    return cachedMarkets;
  }

  // Rate-limit refreshes to avoid hammering APIs
  if (forceRefresh && cachedMarkets && now - lastRefreshTimestamp < REFRESH_TTL) {
    return cachedMarkets;
  }

  // Fetch real platforms in parallel, don't let one failure kill everything
  const [polymarketResult, kalshiResult, limitlessResult] =
    await Promise.allSettled([
      fetchPolymarketMarkets(),
      fetchKalshiMarkets(),
      fetchLimitlessMarkets(),
    ]);

  const polymarketMarkets =
    polymarketResult.status === "fulfilled" ? polymarketResult.value : [];
  const kalshiMarkets =
    kalshiResult.status === "fulfilled" ? kalshiResult.value : [];
  const limitlessMarkets =
    limitlessResult.status === "fulfilled" ? limitlessResult.value : [];

  if (polymarketResult.status === "rejected") {
    console.warn("[Markets] Polymarket fetch failed:", polymarketResult.reason);
  }
  if (kalshiResult.status === "rejected") {
    console.warn("[Markets] Kalshi fetch failed:", kalshiResult.reason);
  }
  if (limitlessResult.status === "rejected") {
    console.warn("[Markets] Limitless fetch failed:", limitlessResult.reason);
  }

  // Combine real + sample markets (Myriad + Opinion)
  const sampleMarkets = getSampleMarkets();

  const allMarkets = [
    ...polymarketMarkets,
    ...kalshiMarkets,
    ...limitlessMarkets,
    ...sampleMarkets,
  ];

  // Sort by volume descending
  allMarkets.sort((a, b) => b.volume24h - a.volume24h);

  cachedMarkets = allMarkets;
  cacheTimestamp = now;
  lastRefreshTimestamp = now;

  console.log(
    `[Markets] Total: ${allMarkets.length} (Polymarket: ${polymarketMarkets.length}, Kalshi: ${kalshiMarkets.length}, Limitless: ${limitlessMarkets.length}, Sample: ${sampleMarkets.length})`
  );

  return allMarkets;
}

/**
 * Invalidate the market cache so the next fetch is fresh.
 */
export function invalidateMarketCache(): void {
  cacheTimestamp = 0;
}

export function getTopMarketsPerPlatform(
  markets: NormalizedMarket[],
  perPlatform: number = 20
): NormalizedMarket[] {
  const byPlatform = new Map<string, NormalizedMarket[]>();

  for (const m of markets) {
    const arr = byPlatform.get(m.platform) || [];
    arr.push(m);
    byPlatform.set(m.platform, arr);
  }

  const result: NormalizedMarket[] = [];
  for (const [, platformMarkets] of byPlatform) {
    result.push(...platformMarkets.slice(0, perPlatform));
  }

  return result;
}

/**
 * Build spread table rows from SAME_EVENT matches.
 * Shows the same event priced across different platforms.
 */
export function buildSpreadTable(
  markets: NormalizedMarket[],
  matches: MarketMatch[]
): SpreadRow[] {
  const marketMap = new Map(markets.map((m) => [m.id, m]));
  const rows: SpreadRow[] = [];
  const seenEvents = new Set<string>();

  // Only SAME_EVENT matches
  const sameEventMatches = matches.filter(
    (m) => m.relationship === "SAME_EVENT" && m.matchConfidence >= 0.7
  );

  for (const match of sameEventMatches) {
    // Deduplicate — use sorted market IDs
    const eventKey = [match.marketAId, match.marketBId].sort().join(":");
    if (seenEvents.has(eventKey)) continue;
    seenEvents.add(eventKey);

    const mA = marketMap.get(match.marketAId);
    const mB = marketMap.get(match.marketBId);
    if (!mA || !mB) continue;

    const platforms: SpreadRow["platforms"] = {};

    for (const m of [mA, mB]) {
      const spread = m.yesAsk && m.yesBid ? m.yesAsk - m.yesBid : 0;
      platforms[m.platform] = {
        marketId: m.id,
        yesPrice: m.yesPrice,
        noPrice: m.noPrice,
        yesBid: m.yesBid,
        yesAsk: m.yesAsk,
        spread,
        volume24h: m.volume24h,
        url: m.url,
      };
    }

    // Also check if other platforms have the same market (via other matches)
    for (const otherMatch of sameEventMatches) {
      if (otherMatch.id === match.id) continue;
      const isRelated =
        otherMatch.marketAId === match.marketAId ||
        otherMatch.marketAId === match.marketBId ||
        otherMatch.marketBId === match.marketAId ||
        otherMatch.marketBId === match.marketBId;
      if (!isRelated) continue;

      for (const otherId of [otherMatch.marketAId, otherMatch.marketBId]) {
        const otherM = marketMap.get(otherId);
        if (!otherM || platforms[otherM.platform]) continue;
        const spread =
          otherM.yesAsk && otherM.yesBid ? otherM.yesAsk - otherM.yesBid : 0;
        platforms[otherM.platform] = {
          marketId: otherM.id,
          yesPrice: otherM.yesPrice,
          noPrice: otherM.noPrice,
          yesBid: otherM.yesBid,
          yesAsk: otherM.yesAsk,
          spread,
          volume24h: otherM.volume24h,
          url: otherM.url,
        };
      }
    }

    // Calculate max price difference across platforms
    const yesPrices = Object.values(platforms).map((p) => p!.yesPrice);
    const maxPriceDiff =
      yesPrices.length >= 2
        ? Math.max(...yesPrices) - Math.min(...yesPrices)
        : 0;

    rows.push({
      eventName: mA.title.length <= mB.title.length ? mA.title : mB.title,
      category: mA.category,
      matchId: match.id,
      platforms,
      maxPriceDiff,
      arbAvailable: maxPriceDiff > 0.02, // >2 cents difference
    });
  }

  // Sort by max price difference (biggest arb first)
  rows.sort((a, b) => b.maxPriceDiff - a.maxPriceDiff);

  return rows.slice(0, 15); // Cap at 15 for readability
}

/**
 * Select markets relevant to a user query by mixing:
 * 1. Category-matched markets (highest priority)
 * 2. Top markets per platform for diversity
 */
export function selectMarketsForQuery(
  markets: NormalizedMarket[],
  query: string,
  maxTotal: number = 60
): NormalizedMarket[] {
  const lower = query.toLowerCase();
  const seen = new Set<string>();
  const result: NormalizedMarket[] = [];

  // Step 1: keyword-matched markets (title contains query terms)
  const queryWords = lower.split(/\s+/).filter((w) => w.length > 3);
  const keywordMatched = markets.filter((m) => {
    const titleLower = m.title.toLowerCase();
    return queryWords.some((w) => titleLower.includes(w));
  });
  for (const m of keywordMatched.slice(0, 20)) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      result.push(m);
    }
  }

  // Step 2: category-matched markets
  const targetCategories = inferQueryCategories(lower);
  if (targetCategories.length > 0) {
    const catMatched = markets.filter((m) =>
      targetCategories.includes(m.category)
    );
    for (const m of catMatched.slice(0, 20)) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        result.push(m);
      }
    }
  }

  // Step 3: top per platform for diversity (fill remaining slots)
  const remaining = maxTotal - result.length;
  if (remaining > 0) {
    const perPlatform = Math.max(5, Math.floor(remaining / 5));
    const topPerPlatform = getTopMarketsPerPlatform(markets, perPlatform);
    for (const m of topPerPlatform) {
      if (result.length >= maxTotal) break;
      if (!seen.has(m.id)) {
        seen.add(m.id);
        result.push(m);
      }
    }
  }

  return result;
}

function inferQueryCategories(query: string): string[] {
  const cats: string[] = [];
  if (query.match(/tariff|trade|import|export|sanction|customs|duty/))
    cats.push("trade");
  if (query.match(/bitcoin|btc|ethereum|eth|crypto|solana|sol|defi/))
    cats.push("crypto");
  if (query.match(/election|trump|biden|congress|senate|vote|governor/))
    cats.push("politics");
  if (query.match(/recession|gdp|inflation|fed|interest rate|employment|jobs/))
    cats.push("economics");
  if (query.match(/ai|openai|google|apple|microsoft|tech|chip/))
    cats.push("tech");
  if (query.match(/war|conflict|nato|military|nuclear|invade|china|russia/))
    cats.push("geopolitics");
  if (query.match(/climate|weather|hurricane|earthquake/)) cats.push("climate");
  if (query.match(/nfl|nba|mlb|nhl|soccer|football|game|match|world cup/))
    cats.push("sports");
  return cats;
}

export function findMarketById(
  markets: NormalizedMarket[],
  marketId: string
): NormalizedMarket | undefined {
  return markets.find((m) => m.id === marketId);
}

export function findMarketByTitle(
  markets: NormalizedMarket[],
  title: string,
  threshold: number = 0.8
): NormalizedMarket | undefined {
  let bestMatch: NormalizedMarket | undefined;
  let bestScore = 0;

  for (const m of markets) {
    const score = levenshteinSimilarity(
      m.title.toLowerCase(),
      title.toLowerCase()
    );
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = m;
    }
  }

  return bestMatch;
}

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}
