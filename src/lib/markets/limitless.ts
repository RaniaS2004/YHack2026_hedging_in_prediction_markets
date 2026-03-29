import { NormalizedMarket } from "@/types";

const LIMITLESS_API = "https://api.limitless.exchange";

interface LimitlessMarket {
  slug: string;
  id: number;
  title: string;
  description: string;
  categories: string[];
  status: string;
  expirationDate: string;
  expirationTimestamp: number;
  volume: string;
  volumeFormatted: string;
  prices: number[]; // [yesPrice, noPrice]
  liquidity_dollars?: number;
}

export async function fetchLimitlessMarkets(): Promise<NormalizedMarket[]> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    const apiKey = process.env.LIMITLESS_API_KEY;
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const response = await fetch(
      `${LIMITLESS_API}/markets/active?limit=25`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(`[Limitless] API error: ${response.status}`);
      return [];
    }

    const json = await response.json();
    // API wraps results in { data: [...] }
    const rawMarkets: LimitlessMarket[] = Array.isArray(json) ? json : (json.data || []);

    const markets: NormalizedMarket[] = rawMarkets
      .filter((m) => {
        const vol = parseFloat(m.volumeFormatted || m.volume || "0");
        return m.status === "FUNDED" && vol >= 50; // Lower threshold for Limitless
      })
      .map((m) => {
        const yesPrice = m.prices?.[0] ?? 0.5;
        const noPrice = m.prices?.[1] ?? (1 - yesPrice);
        const volume = parseFloat(m.volumeFormatted || m.volume || "0");

        return {
          id: m.slug || String(m.id),
          platform: "limitless" as const,
          title: m.title,
          description: m.description || "",
          category: mapCategory(m.categories),
          yesPrice: clamp(yesPrice),
          noPrice: clamp(noPrice),
          yesBid: 0,
          yesAsk: 0,
          volume24h: volume,
          liquidity: m.liquidity_dollars || 0,
          endDate: m.expirationDate || null,
          resolved: false,
          url: `https://limitless.exchange/markets/${m.slug || m.id}`,
          lastUpdated: new Date().toISOString(),
        };
      });

    console.log(`[Limitless] Fetched ${markets.length} active markets (from ${rawMarkets.length} raw)`);
    return markets;
  } catch (err) {
    console.error("[Limitless] Failed to fetch markets:", err);
    return [];
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function mapCategory(categories: string[] | undefined): string {
  if (!categories || categories.length === 0) return "general";
  const joined = categories.join(" ").toLowerCase();
  if (joined.includes("politic")) return "politics";
  if (joined.includes("crypto") || joined.includes("bitcoin") || joined.includes("ethereum") || joined.includes("solana"))
    return "crypto";
  if (joined.includes("econ") || joined.includes("finance")) return "economics";
  if (joined.includes("tech") || joined.includes("ai")) return "tech";
  if (joined.includes("sport")) return "sports";
  if (joined.includes("trade") || joined.includes("tariff")) return "trade";
  return "general";
}
