const SUPPORTED_TOKENS: Record<string, string> = {
  eth: "ethereum",
  ethereum: "ethereum",
  btc: "bitcoin",
  bitcoin: "bitcoin",
  sol: "solana",
  solana: "solana",
};

const COINGECKO_API = "https://api.coingecko.com/api/v3";

export interface ParsedCryptoPosition {
  token: string;
  coingeckoId: string;
  amount: number;
  side: "long" | "short";
  currentPrice: number;
  totalValue: number;
}

export async function parseCryptoPosition(
  input: string
): Promise<ParsedCryptoPosition | null> {
  const lower = input.toLowerCase().trim();

  // Match patterns like "long 10 ETH", "I'm long 10 ETH", "short 5 BTC", "10 ETH"
  const match = lower.match(
    /(?:i'?m\s+)?(long|short)?\s*(\d+(?:\.\d+)?)\s*(eth|ethereum|btc|bitcoin|sol|solana)/
  );

  if (!match) return null;

  const side = (match[1] as "long" | "short") || "long";
  const amount = parseFloat(match[2]);
  const tokenKey = match[3];
  const coingeckoId = SUPPORTED_TOKENS[tokenKey];

  if (!coingeckoId) return null;

  const price = await fetchTokenPrice(coingeckoId);
  if (!price) return null;

  return {
    token: tokenKey.toUpperCase().replace("ETHEREUM", "ETH").replace("BITCOIN", "BTC").replace("SOLANA", "SOL"),
    coingeckoId,
    amount,
    side,
    currentPrice: price,
    totalValue: amount * price,
  };
}

async function fetchTokenPrice(coingeckoId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${coingeckoId}&vs_currencies=usd`,
      { next: { revalidate: 60 } } // 1-min cache
    );

    if (!response.ok) {
      console.error(`[CoinGecko] API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data[coingeckoId]?.usd || null;
  } catch (err) {
    console.error("[CoinGecko] Failed to fetch price:", err);
    return null;
  }
}

export function detectInputType(
  input: string
): "crypto" | "risk" | "position" {
  const lower = input.toLowerCase();

  // Check for crypto patterns
  if (
    lower.match(
      /(?:long|short)?\s*\d+(?:\.\d+)?\s*(?:eth|btc|sol|ethereum|bitcoin|solana)/
    )
  ) {
    return "crypto";
  }

  // Check for position-like patterns (market contract references)
  if (
    lower.match(/(?:position|holding|bought|sold|yes|no)\s+(?:on|in|at)/) ||
    lower.match(/(?:polymarket|kalshi)/)
  ) {
    return "position";
  }

  // Default: plain-English risk description
  return "risk";
}
