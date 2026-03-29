import { openai, OPENAI_MODEL } from "./client";
import { GrokHedgeResponseSchema, GrokHedgeResponse } from "./schemas";
import { getFallbackRecommendations } from "./fallback";
import { parseCryptoPosition, detectInputType } from "./risk-parser";
import { fetchAllMarkets, selectMarketsForQuery, findMarketById, findMarketByTitle } from "../markets";
import {
  ExposureSummary,
  HedgeDiscoveryResult,
  HedgeInputType,
  HedgeObjective,
  HedgeRecommendation,
  HedgeRecommendationGroup,
  HedgeRecommendationType,
  NormalizedMarket,
} from "@/types";
import { zodResponseFormat } from "openai/helpers/zod";

const LIQUIDITY_THRESHOLD = 100; // $100 minimum depth
const GROK_TIMEOUT = 15_000; // 15 seconds

export async function discoverHedges(
  description: string
): Promise<HedgeDiscoveryResult> {
  const inputType = detectInputType(description);
  const platformsUnavailable: string[] = [];
  const defaultObjective = getDefaultObjective(inputType);

  // Step 1: Fetch all markets, select relevant ones for query
  const allMarkets = await fetchAllMarkets();
  const topMarkets = selectMarketsForQuery(allMarkets, description, 60);

  // Step 2: Enrich input if crypto
  let enrichedDescription = description;
  let detectedExposure = description.trim();
  if (inputType === "crypto") {
    const cryptoPos = await parseCryptoPosition(description);
    if (cryptoPos) {
      detectedExposure = `${cryptoPos.side} ${cryptoPos.amount} ${cryptoPos.token}`;
      enrichedDescription = `User holds a ${cryptoPos.side} position of ${cryptoPos.amount} ${cryptoPos.token} (current price: $${cryptoPos.currentPrice.toFixed(2)}, total value: $${cryptoPos.totalValue.toFixed(2)}). They want to hedge this crypto exposure using prediction market contracts.`;
    }
  }

  const exposureSummary = buildExposureSummary(
    description,
    inputType,
    detectedExposure
  );

  // Step 3: Build market context for Grok
  const marketContext = topMarkets
    .map(
      (m) =>
        `[${m.platform}] ID: ${m.id} | Title: "${m.title}" | Category: ${m.category} | YES: $${m.yesPrice.toFixed(2)} | Volume: $${m.volume24h} | Liquidity: $${m.liquidity}`
    )
    .join("\n");

  // Step 4: Call Grok with structured output
  let grokResponse: GrokHedgeResponse | null = null;
  let fallbackUsed = false;

  try {
    grokResponse = await callGrokWithTimeout(
      enrichedDescription,
      marketContext,
      GROK_TIMEOUT
    );
  } catch (err) {
    console.warn("[Hedge Discovery] Grok call failed, using fallback:", err);
  }

  // Step 5: If Grok failed, use fallback
  if (!grokResponse) {
    fallbackUsed = true;
    const fallback = getFallbackRecommendations(description);

    if (!fallback) {
      return {
        recommendations: [],
        groups: [],
        exposureSummary,
        defaultObjective,
        inputType,
        fallbackUsed: true,
        platformsUnavailable,
      };
    }

    const matchingMarkets = topMarkets.filter((m) =>
      fallback.targetCategories.includes(m.category)
    );

    const recommendations: HedgeRecommendation[] = matchingMarkets
      .slice(0, 4)
      .map((m) => {
        const categoryMatch = 1; // fallback already filtered by category
        const confidence = Math.min(
          1,
          0.7 * fallback.correlationStrength + 0.3 * categoryMatch
        );

        return {
          marketId: m.id,
          platform: m.platform,
          title: m.title,
          side: fallback.defaultSide,
          correlationStrength: fallback.correlationStrength,
          category: m.category,
          hedgeRatio: 0.5,
          reasoning: `Pre-computed correlation: ${m.category} market likely correlated to your described risk.`,
          confidence,
          confidenceLevel: getConfidenceLevel(confidence),
          currentPrice:
            fallback.defaultSide === "YES" ? m.yesPrice : m.noPrice,
          hedgeType: classifyRecommendationType(fallback.correlationStrength),
          protectsAgainst: exposureSummary.harmScenario,
          whyThisWorks: `This market has a pre-computed correlation to ${exposureSummary.detectedExposure.toLowerCase()}.`,
          tradeoffs: getTradeoffText(classifyRecommendationType(fallback.correlationStrength)),
          coverageEstimate: Math.min(0.95, fallback.correlationStrength),
          suggestedSize: getSuggestedSize(0.5, fallback.correlationStrength),
          suggestedMaxLoss: getSuggestedSize(0.5, fallback.correlationStrength) *
            (fallback.defaultSide === "YES" ? m.yesPrice : m.noPrice),
        };
      });

    return {
      recommendations,
      groups: groupRecommendations(recommendations),
      exposureSummary,
      defaultObjective,
      inputType,
      fallbackUsed: true,
      platformsUnavailable,
    };
  }

  // Step 6: Validate Grok recommendations against live markets
  const recommendations: HedgeRecommendation[] = [];

  for (const rec of grokResponse.recommendations) {
    // Try to find market by ID first, then by title
    let market: NormalizedMarket | undefined = findMarketById(
      allMarkets,
      rec.marketId
    );
    if (!market) {
      market = findMarketByTitle(allMarkets, rec.title, 0.8);
    }

    // Validation: market must exist, be open, have liquidity
    if (!market) {
      console.log(
        `[Hedge Discovery] Dropped: market not found (ID: ${rec.marketId}, Title: ${rec.title})`
      );
      continue;
    }
    if (market.resolved) {
      console.log(
        `[Hedge Discovery] Dropped: market resolved (${market.id})`
      );
      continue;
    }
    if (market.liquidity < LIQUIDITY_THRESHOLD) {
      console.log(
        `[Hedge Discovery] Dropped: low liquidity $${market.liquidity} (${market.id})`
      );
      continue;
    }

    // Step 7: Compute confidence score
    const categoryMatch =
      rec.category.toLowerCase() ===
      (grokResponse.inputCategory || "").toLowerCase()
        ? 1
        : 0;
    const confidence = Math.min(
      1,
      0.7 * rec.correlationStrength + 0.3 * categoryMatch
    );

    recommendations.push({
      marketId: market.id,
      platform: market.platform,
      title: market.title,
      side: rec.side,
      correlationStrength: rec.correlationStrength,
      category: market.category,
      hedgeRatio: rec.hedgeRatio,
      reasoning: rec.reasoning,
      confidence,
      confidenceLevel: getConfidenceLevel(confidence),
      currentPrice: rec.side === "YES" ? market.yesPrice : market.noPrice,
      hedgeType: classifyRecommendationType(rec.correlationStrength),
      protectsAgainst: exposureSummary.harmScenario,
      whyThisWorks: rec.reasoning,
      tradeoffs: getTradeoffText(classifyRecommendationType(rec.correlationStrength)),
      coverageEstimate: Math.min(
        0.95,
        0.65 * rec.correlationStrength + 0.35 * rec.hedgeRatio
      ),
      suggestedSize: getSuggestedSize(rec.hedgeRatio, rec.correlationStrength),
      suggestedMaxLoss:
        getSuggestedSize(rec.hedgeRatio, rec.correlationStrength) *
        (rec.side === "YES" ? market.yesPrice : market.noPrice),
    });
  }

  // Sort by confidence descending
  recommendations.sort((a, b) => b.confidence - a.confidence);

  return {
    recommendations,
    groups: groupRecommendations(recommendations),
    exposureSummary,
    defaultObjective,
    inputType,
    fallbackUsed,
    platformsUnavailable,
  };
}

async function callGrokWithTimeout(
  description: string,
  marketContext: string,
  timeoutMs: number
): Promise<GrokHedgeResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await openai.chat.completions.parse({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are a prediction market hedging advisor. Given a user's risk exposure or position, recommend prediction market contracts that would hedge their risk.

Rules:
- Only recommend contracts from the provided market list
- Use the exact market IDs from the list
- Recommend 2-4 contracts maximum, from different platforms when possible
- Set correlationStrength based on how directly the market outcome affects the user's risk (1.0 = direct causal link, 0.5 = moderate correlation, 0.2 = weak/speculative)
- Choose the side (YES/NO) that PAYS OUT when the user's risk materializes
- Set hedgeRatio based on how much of the risk each contract covers (1.0 = full hedge, 0.5 = partial)`,
        },
        {
          role: "user",
          content: `User's risk/position: ${description}

Available markets:
${marketContext}

Recommend hedge contracts from this list.`,
        },
      ],
      response_format: zodResponseFormat(GrokHedgeResponseSchema, "hedge_recommendations"),
    });

    const parsed = completion.choices[0]?.message?.parsed;
    if (!parsed) {
      throw new Error("No parsed response from Grok");
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

function getConfidenceLevel(
  confidence: number
): "high" | "medium" | "speculative" {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.45) return "medium";
  return "speculative";
}

function buildExposureSummary(
  description: string,
  inputType: HedgeInputType,
  detectedExposure: string
): ExposureSummary {
  switch (inputType) {
    case "crypto":
      return {
        inputType,
        title: "Crypto exposure detected",
        summary:
          "You appear to have market exposure that can be softened with event contracts tied to macro or crypto downside scenarios.",
        harmScenario:
          "The crypto position moves against you or the market sells off sharply.",
        hedgeIntent:
          "Add contracts that appreciate when the downside scenario materializes.",
        detectedExposure,
        confidence: "high",
        deskView: "Treat this like an overlay on a directional crypto book.",
      };
    case "position":
      return {
        inputType,
        title: "Event book exposure detected",
        summary:
          "You already hold event risk. The goal is to offset concentrated exposure with contracts that pay when your current thesis breaks.",
        harmScenario:
          "Your current market position resolves against you or loses value before resolution.",
        hedgeIntent:
          "Add offsetting contracts that benefit if the original position goes wrong.",
        detectedExposure,
        confidence: "medium",
        deskView: "Treat this like a concentrated event-risk book that needs a hedge sleeve.",
      };
    default:
      return {
        inputType,
        title: "External risk mandate detected",
        summary:
          "You described a real-world risk that can be translated into hedgeable prediction market exposure.",
        harmScenario: `The described scenario materializes: ${description.trim()}`,
        hedgeIntent:
          "Find contracts that pay in the scenario most likely to hurt you.",
        detectedExposure,
        confidence: "medium",
        deskView: "Treat this like a macro or corporate risk overlay, not a standalone trade.",
      };
  }
}

function classifyRecommendationType(
  correlationStrength: number
): HedgeRecommendationType {
  if (correlationStrength >= 0.72) return "direct";
  if (correlationStrength >= 0.5) return "proxy";
  return "speculative";
}

function getTradeoffText(type: HedgeRecommendationType): string {
  switch (type) {
    case "direct":
      return "Highest hedge efficiency, but capacity can be limited and the book can get crowded.";
    case "proxy":
      return "Better liquidity and flexibility, but basis risk is materially higher.";
    case "speculative":
      return "Use as a satellite sleeve only. Correlation may not hold when you need protection most.";
  }
}

function getSuggestedSize(
  hedgeRatio: number,
  correlationStrength: number
): number {
  return Math.max(5, Math.round((8 + hedgeRatio * 10 + correlationStrength * 6) / 5) * 5);
}

function getDefaultObjective(inputType: HedgeInputType): HedgeObjective {
  if (inputType === "risk") return "offset_scenario";
  return "protect_downside";
}

function groupRecommendations(
  recommendations: HedgeRecommendation[]
): HedgeRecommendationGroup[] {
  const definitions: Record<
    HedgeRecommendationType,
    { title: string; description: string }
  > = {
    direct: {
      title: "Core Hedges",
      description: "Highest-conviction contracts for the main hedge sleeve.",
    },
    proxy: {
      title: "Proxy Overlays",
      description: "Liquid substitutes when there is no clean direct expression.",
    },
    speculative: {
      title: "Satellite Hedges",
      description: "Small add-on ideas with weaker linkage to the mandate.",
    },
  };

  return (["direct", "proxy", "speculative"] as HedgeRecommendationType[])
    .map((id) => ({
      id,
      title: definitions[id].title,
      description: definitions[id].description,
      recommendations: recommendations.filter((rec) => rec.hedgeType === id),
    }))
    .filter((group) => group.recommendations.length > 0);
}
