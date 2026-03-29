// === Market Types ===

export interface NormalizedMarket {
  id: string;
  platform: Platform;
  title: string;
  description: string;
  category: string;
  yesPrice: number; // midpoint 0-1
  noPrice: number; // midpoint 0-1
  yesBid: number; // best bid for YES (0 if unknown)
  yesAsk: number; // best ask for YES (0 if unknown)
  volume24h: number; // USD
  liquidity: number; // USD depth
  endDate: string | null;
  resolved: boolean;
  url: string;
  lastUpdated: string; // ISO timestamp
}

export type Platform =
  | "polymarket"
  | "kalshi"
  | "limitless"
  | "myriad"
  | "opinion";

export const REAL_PLATFORMS: Platform[] = ["polymarket", "kalshi", "limitless"];
export const SIMULATED_PLATFORMS: Platform[] = [
  "myriad",
  "opinion",
];

// === Hedge Types ===

export type HedgeInputType = "position" | "crypto" | "risk";

export type HedgeObjective =
  | "protect_downside"
  | "reduce_volatility"
  | "offset_scenario";

export type HedgeRecommendationType = "direct" | "proxy" | "speculative";

export type HedgeProtectionLevel = "partial" | "full";

export interface ExposureSummary {
  inputType: HedgeInputType;
  title: string;
  summary: string;
  harmScenario: string;
  hedgeIntent: string;
  detectedExposure: string;
  confidence: "high" | "medium";
  deskView: string;
}

export interface HedgeRecommendation {
  marketId: string;
  platform: Platform;
  title: string;
  side: "YES" | "NO";
  correlationStrength: number; // 0-1, from Grok
  category: string;
  hedgeRatio: number;
  reasoning: string;
  confidence: number; // computed: 0.7*correlation + 0.3*categoryMatch
  confidenceLevel: "high" | "medium" | "speculative";
  currentPrice: number;
  hedgeType: HedgeRecommendationType;
  protectsAgainst: string;
  whyThisWorks: string;
  tradeoffs: string;
  coverageEstimate: number;
  suggestedSize: number;
  suggestedMaxLoss: number;
}

export interface HedgeRequest {
  description: string;
  type: HedgeInputType;
}

export interface HedgeRecommendationGroup {
  id: HedgeRecommendationType;
  title: string;
  description: string;
  recommendations: HedgeRecommendation[];
}

export interface HedgeExecutionPlan {
  objective: HedgeObjective;
  protectionLevel: HedgeProtectionLevel;
  summary: string;
}

export interface HedgeDiscoveryResult {
  recommendations: HedgeRecommendation[];
  groups: HedgeRecommendationGroup[];
  exposureSummary: ExposureSummary;
  defaultObjective: HedgeObjective;
  inputType: HedgeInputType;
  fallbackUsed: boolean;
  platformsUnavailable: string[];
}

// === Execution / Saga Types ===

export type SagaState =
  | "PENDING"
  | "EXECUTING"
  | "COMPLETED"
  | "ROLLING_BACK"
  | "ROLLED_BACK"
  | "FAILED";

export interface Saga {
  id: string;
  status: SagaState;
  totalCostUsd: number | null;
  spendingCapUsd: number;
  legs: SagaLeg[];
  createdAt: string;
  updatedAt: string;
}

export interface SagaLeg {
  id: string;
  sagaId: string;
  platform: Platform;
  marketId: string;
  marketTitle: string;
  side: "YES" | "NO";
  size: number;
  price: number | null;
  fillPrice: number | null;
  status: "PENDING" | "EXECUTING" | "FILLED" | "FAILED" | "ROLLING_BACK" | "ROLLED_BACK" | "CANCELLED";
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
}

// === Payoff Types ===

export interface PayoffScenario {
  outcomes: Record<string, "YES" | "NO">; // marketId -> outcome
  netPnl: number;
  label: string;
}

export interface PayoffTable {
  scenarios: PayoffScenario[];
  legs: SagaLeg[];
  bestCase: number;
  worstCase: number;
}

// === Market Relationship Types ===

export type MarketRelationship =
  | "SAME_EVENT"
  | "MUTUALLY_EXCLUSIVE"
  | "POSITIVELY_CORRELATED"
  | "NEGATIVELY_CORRELATED"
  | "CONDITIONAL"
  | "INDEPENDENT";

export interface MarketMatch {
  id: string;
  marketAId: string;
  marketAPlatform: Platform;
  marketATitle: string;
  marketBId: string;
  marketBPlatform: Platform;
  marketBTitle: string;
  matchConfidence: number;
  relationship: MarketRelationship;
  reasoning: string;
  expiresAt: string;
}

// === Arbitrage Types ===

export type ArbType = "PRICE_DIVERGENCE" | "COMPLEMENTARY";

export interface ArbOpportunity {
  id: string;
  matchId: string;
  arbType: ArbType;
  profitMargin: number; // after fees, as decimal (0.05 = 5%)
  buyPlatform: Platform;
  buyMarketId: string;
  buyMarketTitle: string;
  buySide: "YES" | "NO";
  buyPrice: number;
  sellPlatform: Platform;
  sellMarketId: string;
  sellMarketTitle: string;
  sellSide: "YES" | "NO";
  sellPrice: number;
  detectedAt: string;
  expired: boolean;
}

// === Portfolio Types ===

export interface UserPosition {
  id: string;
  platform: Platform;
  marketId: string;
  marketTitle: string;
  side: "YES" | "NO";
  quantity: number;
  avgPrice: number;
  currentPrice: number | null;
}

// === Feedback Types ===

export interface HedgeFeedback {
  recommendationId: string;
  marketId: string;
  platform: Platform;
  vote: "up" | "down";
}

// === Spread Table Types ===

export interface SpreadRow {
  eventName: string;
  category: string;
  matchId: string;
  platforms: Partial<
    Record<
      Platform,
      {
        marketId: string;
        yesPrice: number;
        noPrice: number;
        yesBid: number;
        yesAsk: number;
        spread: number; // ask - bid
        volume24h: number;
        url: string;
      }
    >
  >;
  maxPriceDiff: number; // biggest YES price gap across platforms
  arbAvailable: boolean;
}

// === Filter Types ===

export interface ArbFilterState {
  platforms: Platform[];
  minProfit: number; // as percentage, e.g. 1 = 1%
  arbType: ArbType | "ALL";
  category: string; // "all" or specific category
  sortBy: "profit" | "volume" | "spread" | "detected";
}

// === API Response Types ===

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
