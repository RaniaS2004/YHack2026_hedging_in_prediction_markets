import { NormalizedMarket } from "@/types";

const KALSHI_API = "https://api.elections.kalshi.com/trade-api/v2";

interface KalshiEvent {
  event_ticker: string;
  title: string;
  category: string;
  sub_title: string;
  markets: KalshiMarket[];
}

interface KalshiMarket {
  ticker: string;
  title: string;
  yes_sub_title: string;
  no_sub_title: string;
  event_ticker: string;
  status: string;
  close_time: string;
  yes_bid_dollars: number;
  yes_ask_dollars: number;
  no_bid_dollars: number;
  no_ask_dollars: number;
  volume_24h_fp: number;
  volume_fp: number;
  open_interest_fp: number;
  liquidity_dollars: number;
  last_price_dollars: number;
}

/**
 * Fetch Kalshi markets via the events endpoint (two-step):
 * 1. Get all open events (non-sports)
 * 2. Fetch markets for each event with real bid/ask data
 */
export async function fetchKalshiMarkets(): Promise<NormalizedMarket[]> {
  try {
    const now = new Date().toISOString();

    // Step 1: Fetch events (paginated) to get non-sports prediction markets
    const eventTickers: Array<{ ticker: string; title: string }> = [];
    let cursor: string | null = null;

    for (let page = 0; page < 5; page++) {
      const eventsUrl: string =
        `${KALSHI_API}/events?limit=50&status=open` +
        (cursor ? `&cursor=${cursor}` : "");
      const eventsRes: Response = await fetch(eventsUrl, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!eventsRes.ok) break;

      const eventsData: { events?: KalshiEvent[]; cursor?: string } = await eventsRes.json();
      const events = eventsData.events || [];
      cursor = eventsData.cursor || null;

      for (const ev of events) {
        const ticker = (ev.event_ticker || "").toLowerCase();
        const title = (ev.title || "").toLowerCase();

        // Skip sports parlays and multi-game combos
        if (
          ticker.includes("sport") ||
          ticker.includes("mvp") ||
          ticker.includes("multigame") ||
          ticker.includes("crosscategory") ||
          title.match(
            /nba|nfl|mlb|nhl|soccer|basketball|football|baseball|hockey|tennis|ufc|boxing|f1|race|game\s*\d/
          )
        )
          continue;

        eventTickers.push({
          ticker: ev.event_ticker,
          title: ev.title || ev.event_ticker,
        });
      }

      if (!cursor) break;
    }

    console.log(
      `[Kalshi] Found ${eventTickers.length} non-sports events`
    );

    // Step 2: Fetch markets for each event (parallel, batched)
    const allMarkets: NormalizedMarket[] = [];
    const batchSize = 15;

    for (let i = 0; i < eventTickers.length; i += batchSize) {
      const batch = eventTickers.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (ev) => {
          const res = await fetch(
            `${KALSHI_API}/markets?event_ticker=${ev.ticker}&limit=20`,
            {
              headers: { Accept: "application/json" },
              cache: "no-store",
              signal: AbortSignal.timeout(5000),
            }
          );
          if (!res.ok) return [];
          const data = await res.json();
          return (data.markets || []) as KalshiMarket[];
        })
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status !== "fulfilled") continue;
        const rawMarkets = result.value;
        const eventTitle = batch[j].title;

        for (const m of rawMarkets) {
          if (m.status !== "active") continue;

          const yesBid = parseFloat(String(m.yes_bid_dollars || 0));
          const yesAsk = parseFloat(String(m.yes_ask_dollars || 0));

          const yesPrice =
            yesBid && yesAsk
              ? (yesBid + yesAsk) / 2
              : m.last_price_dollars
                ? parseFloat(String(m.last_price_dollars))
                : 0.5;

          // Skip markets with no meaningful price data
          if (yesPrice <= 0 || yesPrice >= 1) continue;

          // Use event title for better categorization context
          const fullTitle = m.title || m.yes_sub_title || eventTitle;

          allMarkets.push({
            id: m.ticker,
            platform: "kalshi",
            title: fullTitle,
            description: m.yes_sub_title || eventTitle,
            category: inferKalshiCategory(
              m.ticker + " " + fullTitle + " " + eventTitle
            ),
            yesPrice: clamp(yesPrice),
            noPrice: clamp(1 - yesPrice),
            yesBid: clamp(yesBid),
            yesAsk: clamp(yesAsk),
            volume24h: parseFloat(String(m.volume_24h_fp || 0)),
            liquidity: parseFloat(
              String(m.liquidity_dollars || m.open_interest_fp || 0)
            ),
            endDate: m.close_time || null,
            resolved: false,
            url: `https://kalshi.com/markets/${m.event_ticker || m.ticker}`,
            lastUpdated: now,
          });
        }
      }
    }

    // Sort by total volume descending
    allMarkets.sort(
      (a, b) => b.volume24h - a.volume24h || b.liquidity - a.liquidity
    );

    console.log(
      `[Kalshi] Fetched ${allMarkets.length} active prediction markets`
    );

    // Cap at 300 to be reasonable
    return allMarkets.slice(0, 300);
  } catch (err) {
    console.error("[Kalshi] Failed to fetch markets:", err);
    return [];
  }
}

function clamp(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function inferKalshiCategory(text: string): string {
  const lower = text.toLowerCase();
  if (
    lower.match(
      /trump|biden|election|senate|congress|governor|vote|political|president|democrat|republican|party|nominee|nomination/
    )
  )
    return "politics";
  if (lower.match(/tariff|trade|import|export|sanction/)) return "trade";
  if (lower.match(/bitcoin|btc|ethereum|eth|crypto|sol|token|defi/))
    return "crypto";
  if (
    lower.match(
      /fed|rate|inflation|gdp|recession|cpi|employment|treasury|economy|s&p|stock|ipo|earnings|revenue/
    )
  )
    return "economics";
  if (lower.match(/ai\b|openai|anthropic|google|apple|tech|chip|nvidia|semiconductor/))
    return "tech";
  if (
    lower.match(
      /war|conflict|nato|military|nuclear|china|russia|ukraine|iran|israel|pope|vatican|g7|leader|prime minister|ceasefire/
    )
  )
    return "geopolitics";
  if (lower.match(/climate|weather|hurricane|earthquake|temperature|warming|fusion/))
    return "climate";
  if (lower.match(/nfl|nba|mlb|nhl|soccer|football|game|match|fifa|ufc/))
    return "sports";
  return "general";
}
