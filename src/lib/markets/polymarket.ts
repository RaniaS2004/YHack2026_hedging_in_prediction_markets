import { NormalizedMarket } from "@/types";

const CLOB_API = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

interface PolymarketEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  markets: PolymarketMarketData[];
}

interface PolymarketMarketData {
  id: string;
  question: string;
  description: string;
  outcomePrices: string; // JSON string like "[\"0.65\",\"0.35\"]"
  volume: string;
  liquidity: string;
  endDate: string;
  active: boolean;
  closed: boolean;
  groupItemTitle: string;
  conditionId: string;
  slug: string;
  bestBid: number;
  bestAsk: number;
  clobTokenIds: string; // JSON array of token IDs
}

interface ClobBookResponse {
  market: string;
  asset_id: string;
  bids: Array<{ price: string; size: string }>;
  asks: Array<{ price: string; size: string }>;
}

/**
 * Fetch best bid/ask from Polymarket CLOB for a set of token IDs.
 * Uses the /books endpoint for batch fetching.
 */
async function fetchClobPrices(
  tokenIds: string[]
): Promise<Map<string, { bid: number; ask: number; mid: number }>> {
  const priceMap = new Map<string, { bid: number; ask: number; mid: number }>();
  if (tokenIds.length === 0) return priceMap;

  try {
    // CLOB /books endpoint doesn't exist for batch, use /book per token
    // But we can batch with Promise.allSettled for speed
    const batchSize = 20;
    for (let i = 0; i < tokenIds.length; i += batchSize) {
      const batch = tokenIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (tokenId) => {
          const res = await fetch(`${CLOB_API}/book?token_id=${tokenId}`, {
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) return null;
          const data: ClobBookResponse = await res.json();
          return { tokenId, data };
        })
      );

      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value) continue;
        const { tokenId, data } = result.value;
        const bestBid = data.bids?.[0]
          ? parseFloat(data.bids[0].price)
          : 0;
        const bestAsk = data.asks?.[0]
          ? parseFloat(data.asks[0].price)
          : 0;
        const mid =
          bestBid && bestAsk
            ? (bestBid + bestAsk) / 2
            : bestBid || bestAsk || 0;
        priceMap.set(tokenId, { bid: bestBid, ask: bestAsk, mid });
      }
    }
  } catch (err) {
    console.warn("[Polymarket CLOB] Batch price fetch failed:", err);
  }

  return priceMap;
}

export async function fetchPolymarketMarkets(): Promise<NormalizedMarket[]> {
  try {
    // Use Gamma API for market discovery (public, no auth needed)
    const response = await fetch(
      `${GAMMA_API}/events?active=true&closed=false&limit=100&order=volume24hr&ascending=false`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      console.error(`[Polymarket] Gamma API error: ${response.status}`);
      return [];
    }

    const events: PolymarketEvent[] = await response.json();
    const now = new Date().toISOString();

    // Collect all YES token IDs for CLOB price fetch
    const tokenIdToMarketId = new Map<string, string>();
    const prelimMarkets: Array<{
      market: PolymarketMarketData;
      event: PolymarketEvent;
      volume: number;
    }> = [];

    for (const event of events) {
      for (const m of event.markets) {
        if (m.closed || !m.active) continue;
        const volume = parseFloat(m.volume) || 0;
        if (volume < 500) continue;

        prelimMarkets.push({ market: m, event, volume });

        // Parse CLOB token IDs - first token is YES
        try {
          if (m.clobTokenIds) {
            const tokenIds = JSON.parse(m.clobTokenIds);
            if (tokenIds[0]) {
              tokenIdToMarketId.set(tokenIds[0], m.conditionId || m.id);
            }
          }
        } catch {
          // skip
        }
      }
    }

    // Fetch real-time CLOB prices for top 50 markets (by volume)
    const topTokenIds = Array.from(tokenIdToMarketId.keys()).slice(0, 50);
    const clobPrices = await fetchClobPrices(topTokenIds);

    // Build a map from marketId to CLOB prices
    const marketClobPrices = new Map<
      string,
      { bid: number; ask: number; mid: number }
    >();
    for (const [tokenId, prices] of clobPrices) {
      const marketId = tokenIdToMarketId.get(tokenId);
      if (marketId) {
        marketClobPrices.set(marketId, prices);
      }
    }

    const markets: NormalizedMarket[] = [];

    for (const { market: m, event, volume } of prelimMarkets) {
      const marketId = m.conditionId || m.id;
      const clobData = marketClobPrices.get(marketId);

      let yesPrice = 0.5;
      let noPrice = 0.5;
      let yesBid = 0;
      let yesAsk = 0;

      if (clobData && clobData.mid > 0) {
        // Use CLOB data (real-time orderbook)
        yesPrice = clobData.mid;
        noPrice = 1 - clobData.mid;
        yesBid = clobData.bid;
        yesAsk = clobData.ask;
      } else {
        // Fallback to Gamma outcomePrices
        try {
          const prices = JSON.parse(m.outcomePrices);
          yesPrice = parseFloat(prices[0]) || 0.5;
          noPrice = parseFloat(prices[1]) || 0.5;
        } catch {
          // use defaults
        }
      }

      markets.push({
        id: marketId,
        platform: "polymarket",
        title: m.question || m.groupItemTitle || event.title,
        description: m.description || event.description || "",
        category: inferCategory(event.title + " " + m.question),
        yesPrice,
        noPrice,
        yesBid,
        yesAsk,
        volume24h: volume,
        liquidity: parseFloat(m.liquidity) || 0,
        endDate: m.endDate || null,
        resolved: false,
        url: `https://polymarket.com/event/${event.slug}`,
        lastUpdated: now,
      });
    }

    console.log(
      `[Polymarket] Fetched ${markets.length} active markets (${clobPrices.size} with CLOB prices)`
    );
    return markets;
  } catch (err) {
    console.error("[Polymarket] Failed to fetch markets:", err);
    return [];
  }
}

function inferCategory(text: string): string {
  const lower = text.toLowerCase();
  if (lower.match(/trump|biden|election|senate|congress|governor|vote|democrat|republican|political|president|vance|harris|desantis|party/))
    return "politics";
  if (lower.match(/tariff|trade war|import|export|sanction|customs|duty|quota/))
    return "trade";
  if (lower.match(/bitcoin|btc|ethereum|eth|crypto|solana|sol|defi|token|coin|nft|binance|coinbase/))
    return "crypto";
  if (lower.match(/fed|interest rate|inflation|gdp|recession|employment|jobs|unemployment|cpi|s&p|stock|market crash|bear market|bull market|treasury|bond/))
    return "economics";
  if (lower.match(/ai\b|openai|google|apple|microsoft|tech|chip|semiconductor|nvidia|meta|amazon|spacex|starship/))
    return "tech";
  if (lower.match(/war|conflict|nato|military|nuclear|invade|invasion|china|russia|ukraine|taiwan|iran|israel|gaza|hezbollah|houthi/))
    return "geopolitics";
  if (lower.match(/climate|weather|hurricane|earthquake|wildfire|flood|temperature/))
    return "climate";
  if (lower.match(/nfl|nba|mlb|nhl|soccer|football|game|match|world cup|fifa|championship|ufc|boxing|tennis|f1|formula/))
    return "sports";
  return "general";
}
