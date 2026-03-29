import { openai, OPENAI_MODEL } from "./client";
import {
  GrokHedgeResponseSchema,
  GrokHedgeResponse,
  HedgeRiskParseResponse,
  HedgeRiskParseSchema,
  HedgeSearchResponse,
  HedgeSearchResponseSchema,
  HedgeSkepticResponse,
  HedgeSkepticResponseSchema,
} from "./schemas";
import { getFallbackRecommendations } from "./fallback";
import { parseCryptoPosition, detectInputType } from "./risk-parser";
import { fetchAllMarkets, selectMarketsForQuery, findMarketById, findMarketByTitle } from "../markets";
import {
  ExposureSummary,
  HedgeCommitteeDecision,
  HedgeCommitteeMember,
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

const CAUSAL_FACTOR_GRAPH: Array<{
  keywords: string[];
  factors: string[];
  categories: string[];
}> = [
  {
    keywords: ["iran", "oil", "crude", "middle east", "war", "conflict", "geopolitical"],
    factors: ["oil spike", "energy shock", "inflation", "risk-off", "military conflict"],
    categories: ["politics", "economics"],
  },
  {
    keywords: ["tariff", "trade war", "import", "export", "sanction"],
    factors: ["supply chain", "equity drawdown", "growth slowdown", "inflation"],
    categories: ["trade", "economics", "politics"],
  },
  {
    keywords: ["fed", "rates", "higher for longer", "inflation", "cpi"],
    factors: ["duration selloff", "nasdaq drawdown", "recession"],
    categories: ["economics"],
  },
  {
    keywords: ["bitcoin", "btc", "crypto", "ethereum", "eth"],
    factors: ["etf outflows", "risk-off", "liquidity stress"],
    categories: ["crypto", "economics"],
  },
  {
    keywords: ["election", "regulation", "policy", "trump", "biden"],
    factors: ["political control", "regulatory tightening", "sector repricing"],
    categories: ["politics", "economics"],
  },
];

export async function discoverHedges(
  description: string
): Promise<HedgeDiscoveryResult> {
  const inputType = detectInputType(description);
  const platformsUnavailable: string[] = [];
  const defaultObjective = getDefaultObjective(inputType);

  // Step 1: Fetch all markets, select relevant ones for query
  const allMarkets = await fetchAllMarkets();
  const topMarkets = selectMarketsForQuery(allMarkets, description, 60);

  const curatedDemo = buildCuratedDemoResult(
    description,
    inputType,
    defaultObjective,
    allMarkets
  );
  if (curatedDemo) {
    return curatedDemo;
  }

  // Step 2: Enrich input if crypto
  let detectedExposure = description.trim();
  if (inputType === "crypto") {
    const cryptoPos = await parseCryptoPosition(description);
    if (cryptoPos) {
      detectedExposure = `${cryptoPos.side} ${cryptoPos.amount} ${cryptoPos.token}`;
    }
  }

  const parserOutput = await runRiskParserAgent(
    description,
    inputType,
    detectedExposure
  );

  const exposureSummary = buildExposureSummary(
    description,
    inputType,
    parserOutput.detectedExposure
  );
  const expandedProfile = buildExpandedRiskProfile(description, parserOutput);

  // Step 3: Search market universe with parser output
  const primarySearchUniverse = selectMarketsForQuery(
    allMarkets,
    `${parserOutput.searchQuery} ${parserOutput.targetCategories.join(" ")} ${expandedProfile.searchTerms.join(" ")}`,
    40
  );
  const expandedSearchUniverse = buildExpandedSearchUniverse(
    allMarkets,
    primarySearchUniverse,
    expandedProfile
  );
  let searchOutput = await runMarketSearchAgent(parserOutput, expandedSearchUniverse);
  let shortlistedMarkets = resolveShortlistedMarkets(
    searchOutput,
    expandedSearchUniverse,
    topMarkets
  );

  if (shortlistedMarkets.length < 3) {
    searchOutput = buildHeuristicSearch(parserOutput, expandedSearchUniverse.slice(0, 12));
    shortlistedMarkets = resolveShortlistedMarkets(
      searchOutput,
      expandedSearchUniverse,
      topMarkets
    );
  }

  // Step 4: Build market context for constructor agent
  const marketContext = shortlistedMarkets
    .map(
      (m) =>
        `[${m.platform}] ID: ${m.id} | Title: "${m.title}" | Category: ${m.category} | YES: $${m.yesPrice.toFixed(2)} | Volume: $${m.volume24h} | Liquidity: $${m.liquidity}`
    )
    .join("\n");

  // Step 5: Run constructor agent with structured output
  let grokResponse: GrokHedgeResponse | null = null;
  let fallbackUsed = false;

  try {
    grokResponse = await runHedgeConstructorAgent(
      parserOutput,
      marketContext,
      GROK_TIMEOUT
    );
  } catch (err) {
    console.warn("[Hedge Discovery] Constructor agent failed, using fallback:", err);
  }

  // Step 6: If constructor failed, use fallback
  if (!grokResponse) {
    fallbackUsed = true;
    const fallback = getFallbackRecommendations(description);

    if (!fallback) {
      return {
        recommendations: [],
        groups: [],
        exposureSummary,
        committee: buildCommittee(exposureSummary, parserOutput, searchOutput, [], null, true),
        defaultObjective,
        inputType,
        fallbackUsed: true,
        platformsUnavailable,
      };
    }

    const matchingMarkets = shortlistedMarkets.filter((m) =>
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
      committee: buildCommittee(
        exposureSummary,
        parserOutput,
        searchOutput,
        recommendations,
        buildHeuristicSkeptic(recommendations, true),
        true
      ),
      defaultObjective,
      inputType,
      fallbackUsed: true,
      platformsUnavailable,
    };
  }

  // Step 7: Validate constructor recommendations against live markets
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

  const skepticOutput = await runSkepticAgent(parserOutput, recommendations);
  let filteredRecommendations = applySkepticVerdict(recommendations, skepticOutput);

  if (filteredRecommendations.length === 0) {
    filteredRecommendations = buildCausalFallbackRecommendations(
      expandedSearchUniverse,
      expandedProfile,
      exposureSummary
    );
  }

  // Sort by confidence descending
  filteredRecommendations.sort((a, b) => b.confidence - a.confidence);

  return {
    recommendations: filteredRecommendations,
    groups: groupRecommendations(filteredRecommendations),
    exposureSummary,
    committee: buildCommittee(
      exposureSummary,
      parserOutput,
      searchOutput,
      filteredRecommendations,
      skepticOutput,
      fallbackUsed
    ),
    defaultObjective,
    inputType,
    fallbackUsed,
    platformsUnavailable,
  };
}

async function runHedgeConstructorAgent(
  parserOutput: HedgeRiskParseResponse,
  marketContext: string,
  timeoutMs: number
): Promise<GrokHedgeResponse> {
  const request = openai.chat.completions.parse({
    model: OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: `You are the Hedge Constructor agent in a multi-agent prediction-market hedge desk.

Given a structured risk brief and a searched market list, construct the best hedge sleeve.

Rules:
- Only recommend contracts from the provided market list
- Use the exact market IDs from the list
- Recommend 2-4 contracts maximum, from different platforms when possible
- Set correlationStrength based on how directly the market outcome affects the user's risk (1.0 = direct causal link, 0.5 = moderate correlation, 0.2 = weak/speculative)
- Choose the side (YES/NO) that PAYS OUT when the user's risk materializes
- Set hedgeRatio based on how much of the risk each contract covers (1.0 = full hedge, 0.5 = partial)
- Prefer prediction-market overlays that a risk desk could defend in front of an investment committee`,
      },
      {
        role: "user",
        content: `Structured risk brief:
Exposure: ${parserOutput.detectedExposure}
Downside scenario: ${parserOutput.downsideScenario}
Hedge intent: ${parserOutput.hedgeIntent}
Risk factors: ${parserOutput.riskFactors.join(", ")}
Target categories: ${parserOutput.targetCategories.join(", ")}
Search summary: ${parserOutput.summary}

Available markets:
${marketContext}

Construct the hedge sleeve from this list.`,
      },
    ],
    response_format: zodResponseFormat(GrokHedgeResponseSchema, "hedge_recommendations"),
  });

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Constructor agent timed out after ${timeoutMs}ms`)),
      timeoutMs
    )
  );

  const completion = await Promise.race([request, timeout]);
  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    throw new Error("No parsed response from constructor agent");
  }

  return parsed;
}

async function runRiskParserAgent(
  description: string,
  inputType: HedgeInputType,
  detectedExposure: string
): Promise<HedgeRiskParseResponse> {
  try {
    const completion = await openai.chat.completions.parse({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are the Risk Parser agent in a multi-agent prediction-market hedge desk.

Turn a free-form hedge mandate into a clean structured risk brief. Keep it concise, finance-native, and specific.`,
        },
        {
          role: "user",
          content: `User mandate: ${description}
Input type: ${inputType}
Initial exposure detection: ${detectedExposure}

Return a structured risk brief for downstream hedge search.`,
        },
      ],
      response_format: zodResponseFormat(HedgeRiskParseSchema, "hedge_risk_parse"),
    });

    return completion.choices[0]?.message?.parsed ?? buildHeuristicRiskParse(description, inputType, detectedExposure);
  } catch {
    return buildHeuristicRiskParse(description, inputType, detectedExposure);
  }
}

async function runMarketSearchAgent(
  parserOutput: HedgeRiskParseResponse,
  markets: NormalizedMarket[]
): Promise<HedgeSearchResponse> {
  const marketContext = markets
    .slice(0, 24)
    .map(
      (m) =>
        `[${m.platform}] ID: ${m.id} | Title: "${m.title}" | Category: ${m.category} | YES: $${m.yesPrice.toFixed(2)} | Vol24h: $${m.volume24h} | Liquidity: $${m.liquidity}`
    )
    .join("\n");

  try {
    const completion = await openai.chat.completions.parse({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are the Market Search agent in a multi-agent prediction-market hedge desk.

You do not build the hedge. You shortlist the most relevant hedge candidates from the provided market universe.`,
        },
        {
          role: "user",
          content: `Risk brief:
Exposure: ${parserOutput.detectedExposure}
Downside scenario: ${parserOutput.downsideScenario}
Hedge intent: ${parserOutput.hedgeIntent}
Risk factors: ${parserOutput.riskFactors.join(", ")}
Target categories: ${parserOutput.targetCategories.join(", ")}
Time horizon: ${parserOutput.timeHorizon}

Market universe:
${marketContext}

Return the best shortlist for hedge construction.`,
        },
      ],
      response_format: zodResponseFormat(HedgeSearchResponseSchema, "hedge_search"),
    });

    return completion.choices[0]?.message?.parsed ?? buildHeuristicSearch(parserOutput, markets);
  } catch {
    return buildHeuristicSearch(parserOutput, markets);
  }
}

async function runSkepticAgent(
  parserOutput: HedgeRiskParseResponse,
  recommendations: HedgeRecommendation[]
): Promise<HedgeSkepticResponse> {
  if (recommendations.length === 0) {
    return buildHeuristicSkeptic([], false);
  }

  try {
    const completion = await openai.chat.completions.parse({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You are the Skeptic agent in a multi-agent prediction-market hedge desk.

Your job is to attack weak correlations, basis risk, poor liquidity, and demo-friendly but fragile hedge logic. Be harsh but practical.`,
        },
        {
          role: "user",
          content: `Risk brief:
Exposure: ${parserOutput.detectedExposure}
Downside scenario: ${parserOutput.downsideScenario}
Risk factors: ${parserOutput.riskFactors.join(", ")}

Proposed hedge sleeve:
${recommendations
  .map(
    (rec) =>
      `- ${rec.marketId} | ${rec.title} | ${rec.side} | confidence=${rec.confidence.toFixed(2)} | coverage=${rec.coverageEstimate.toFixed(2)} | liquidity expression=${rec.hedgeType}`
  )
  .join("\n")}

Return a skeptic verdict.`,
        },
      ],
      response_format: zodResponseFormat(HedgeSkepticResponseSchema, "hedge_skeptic"),
    });

    return completion.choices[0]?.message?.parsed ?? buildHeuristicSkeptic(recommendations, false);
  } catch {
    return buildHeuristicSkeptic(recommendations, false);
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

function buildCommittee(
  exposureSummary: ExposureSummary,
  parserOutput: HedgeRiskParseResponse,
  searchOutput: HedgeSearchResponse,
  recommendations: HedgeRecommendation[],
  skepticOutput: HedgeSkepticResponse | null,
  fallbackUsed: boolean
): { members: HedgeCommitteeMember[]; decision: HedgeCommitteeDecision } {
  const top = recommendations[0] ?? null;
  const second = recommendations[1] ?? null;
  const avgConfidence =
    recommendations.length > 0
      ? recommendations.reduce((sum, rec) => sum + rec.confidence, 0) /
        recommendations.length
      : 0;
  const speculativeCount = recommendations.filter(
    (rec) => rec.confidenceLevel === "speculative"
  ).length;

  const members: HedgeCommitteeMember[] = [
    {
      role: "risk_parser",
      title: "Risk Parser",
      verdict: "support",
      summary: parserOutput.summary,
    },
    {
      role: "market_search",
      title: "Market Search",
      verdict: recommendations.length > 0 ? "support" : "caution",
      summary: searchOutput.summary,
    },
    {
      role: "hedge_constructor",
      title: "Hedge Constructor",
      verdict: top ? "support" : "caution",
      summary: top
        ? `Builds the sleeve around ${top.title}${second ? ` plus ${second.title}` : ""}, aiming for ${Math.round((top.coverageEstimate ?? 0) * 100)}% first-leg coverage before objective sizing is applied.`
        : "Cannot construct a sleeve because the search layer did not surface a reliable lead contract.",
    },
    {
      role: "skeptic",
      title: "Skeptic",
      verdict:
        skepticOutput?.verdict === "accept" && !fallbackUsed ? "support" : "caution",
      summary:
        fallbackUsed
          ? "Flags that the system is operating in fallback mode, so the mapping should be treated as a directional overlay, not a fully trusted hedge."
          : skepticOutput?.summary ??
            (speculativeCount > 0
              ? `Flags ${speculativeCount} speculative leg${speculativeCount === 1 ? "" : "s"} and warns that basis risk could widen under stress.`
              : "Accepts the sleeve because the top candidates are direct enough to justify execution review."),
    },
  ];

  const confidence =
    skepticOutput?.confidence ??
    (avgConfidence >= 0.72
      ? "high"
      : avgConfidence >= 0.5
        ? "medium"
        : "speculative");

  const decision: HedgeCommitteeDecision = {
    recommendedSleeve: top
      ? `${top.title}${second ? ` + ${second.title}` : ""}`
      : "No sleeve approved",
    acceptanceReason:
      skepticOutput?.acceptanceReason ??
      (top
        ? `The committee approves the sleeve because ${top.title} is the cleanest prediction-market expression of the user’s downside, and the rest of the sleeve improves coverage without overwhelming basis risk.`
        : "The committee does not approve a sleeve yet because the system could not find a strong enough prediction-market mapping."),
    dissentingView: fallbackUsed
      ? "The skeptic is worried that this fallback mapping may look cleaner in the demo than in a stressed market, so review basis risk before execution."
      : skepticOutput?.dissentingView ??
        (speculativeCount > 0 || avgConfidence < 0.58
          ? "The skeptic is worried that proxy logic may look better in the demo than in a stressed market, so the user should review basis risk before execution."
          : null),
    confidence,
  };

  return { members, decision };
}

function buildCuratedDemoResult(
  description: string,
  inputType: HedgeInputType,
  defaultObjective: HedgeObjective,
  allMarkets: NormalizedMarket[]
): HedgeDiscoveryResult | null {
  const lower = description.toLowerCase();

  const scenarios = [
    {
      match: (text: string) =>
        text.includes("tariff") ||
        text.includes("importer") ||
        text.includes("chinese goods"),
      exposure: "US importer exposed to tariff-driven margin compression.",
      summary:
        "Recognizes a tariff-sensitive corporate mandate and reframes it as trade shock plus second-order macro slowdown risk.",
      searchSummary:
        "Shortlisted direct tariff contracts first, then added a second-order equity stress proxy to make the demo sleeve more interesting and more defensible.",
      skepticSummary:
        "Accepts the sleeve because the direct tariff legs are strong and the equity drawdown leg is a deliberate second-order proxy rather than random beta.",
      acceptanceReason:
        "The committee approves this sleeve because tariff escalation is directly hedgeable, and the added equity-stress leg captures the non-obvious second-order effect on importer margins and sentiment.",
      dissentingView:
        "The skeptic notes that the macro leg is a proxy, so the user should size it smaller than the direct tariff contracts.",
      legs: [
        {
          marketId: "pm-us-china-tariffs-2026",
          side: "YES" as const,
          correlationStrength: 0.9,
          hedgeRatio: 0.6,
          hedgeType: "direct" as const,
          whyThisWorks:
            "A direct tariff contract pays when the user’s cost shock materializes.",
        },
        {
          marketId: "pm-supply-chain-stress-2026",
          side: "YES" as const,
          correlationStrength: 0.76,
          hedgeRatio: 0.45,
          hedgeType: "proxy" as const,
          whyThisWorks:
            "Supply-chain disruption is a cleaner operating-impact proxy than a generic market hedge.",
        },
        {
          marketId: "pm-sp500-down-15-2026",
          side: "YES" as const,
          correlationStrength: 0.62,
          hedgeRatio: 0.3,
          hedgeType: "proxy" as const,
          whyThisWorks:
            "This is the non-obvious leg: tariff escalation can spill into broader risk-off pricing before the direct operating hit is visible.",
        },
      ],
    },
    {
      match: (text: string) =>
        text.includes("iran") ||
        text.includes("oil shock") ||
        text.includes("crude") ||
        (text.includes("war") && text.includes("oil")) ||
        (text.includes("geopolitical") && text.includes("oil")),
      exposure: "Book exposed to an oil shock driven by geopolitical escalation involving Iran.",
      summary:
        "Recognizes a geopolitical energy mandate and reframes it as direct conflict risk plus oil-spike transmission into broader risk-off pricing.",
      searchSummary:
        "Shortlisted a direct US-Iran conflict contract, then paired it with crude-oil spike contracts to express the operating shock more directly.",
      skepticSummary:
        "Accepts the sleeve because the conflict leg captures the event catalyst and the oil legs capture the actual P&L transmission channel.",
      acceptanceReason:
        "The committee approves this sleeve because geopolitical escalation is directly hedgeable and the crude legs are the clearest prediction-market expression of the oil shock the user actually cares about.",
      dissentingView:
        "The skeptic would size the direct conflict leg smaller than the oil contracts because the portfolio loss is likely to travel through energy prices, not the headline alone.",
      legs: [
        {
          marketId: "pm-us-iran-conflict-2026",
          side: "YES" as const,
          correlationStrength: 0.82,
          hedgeRatio: 0.3,
          hedgeType: "direct" as const,
          whyThisWorks:
            "This is the catalyst leg. It pays on the geopolitical trigger that can force energy markets to gap higher.",
        },
        {
          marketId: "pm-brent-above-95-2026",
          side: "YES" as const,
          correlationStrength: 0.88,
          hedgeRatio: 0.6,
          hedgeType: "direct" as const,
          whyThisWorks:
            "This is the P&L leg. Brent above $95 is the cleanest direct expression of an oil price shock hitting the book.",
        },
        {
          marketId: "kalshi-oil-above-90-2026",
          side: "YES" as const,
          correlationStrength: 0.79,
          hedgeRatio: 0.45,
          hedgeType: "proxy" as const,
          whyThisWorks:
            "A second energy leg diversifies venue risk and captures spillover if crude reprices before the conflict thesis is fully confirmed.",
        },
      ],
    },
    {
      match: (text: string) =>
        text.includes("fed staying higher") ||
        text.includes("higher for longer") ||
        text.includes("rates stay restrictive"),
      exposure: "Growth book exposed to higher-for-longer rates and multiple compression.",
      summary:
        "Recognizes a duration-sensitive growth mandate and translates it into rate persistence plus equity drawdown risk.",
      searchSummary:
        "Shortlisted a direct Fed persistence contract, then paired it with growth-sensitive market stress proxies.",
      skepticSummary:
        "Accepts the sleeve because the rate leg is direct and the equity legs are consistent with the user’s downside regime.",
      acceptanceReason:
        "The committee approves this sleeve because Fed persistence is the direct macro driver and the equity drawdown legs express the most likely transmission channel into the user’s book.",
      dissentingView: null,
      legs: [
        {
          marketId: "kalshi-fed-above-425-sep-2026",
          side: "YES" as const,
          correlationStrength: 0.9,
          hedgeRatio: 0.65,
          hedgeType: "direct" as const,
          whyThisWorks:
            "The rates regime itself is the cleanest hedge expression.",
        },
        {
          marketId: "kalshi-nasdaq-down-12-2026",
          side: "YES" as const,
          correlationStrength: 0.8,
          hedgeRatio: 0.45,
          hedgeType: "proxy" as const,
          whyThisWorks:
            "Growth repricing shows up quickly in high-duration equity indices.",
        },
        {
          marketId: "kalshi-us-recession-2026",
          side: "YES" as const,
          correlationStrength: 0.58,
          hedgeRatio: 0.25,
          hedgeType: "proxy" as const,
          whyThisWorks:
            "A recession contract captures the tail scenario embedded in a prolonged restrictive-rate regime.",
        },
      ],
    },
    {
      match: (text: string) =>
        text.includes("bitcoin drawdown") ||
        text.includes("long btc") ||
        text.includes("btc treasury"),
      exposure: "BTC-linked book exposed to a crypto drawdown and broader risk-off conditions.",
      summary:
        "Recognizes a crypto downside mandate and translates it into direct crypto flow stress plus cross-asset risk-off spillover.",
      searchSummary:
        "Shortlisted a direct crypto-flow contract, a crypto stress proxy, and a broader risk-off equity leg.",
      skepticSummary:
        "Allows the sleeve because the first leg is direct, but warns that the macro spillover legs should stay smaller.",
      acceptanceReason:
        "The committee approves this sleeve because ETF outflows are a direct expression of BTC stress, while the additional legs capture market structure and correlated risk-off transmission.",
      dissentingView:
        "The skeptic would cap the macro leg because it is a regime proxy rather than a pure crypto hedge.",
      legs: [
        {
          marketId: "pm-eth-etf-outflows-2026",
          side: "YES" as const,
          correlationStrength: 0.86,
          hedgeRatio: 0.55,
          hedgeType: "direct" as const,
          whyThisWorks:
            "ETF outflows are a clean observable proxy for sustained BTC downside pressure.",
        },
        {
          marketId: "pm-btc-below-75k-2026",
          side: "YES" as const,
          correlationStrength: 0.57,
          hedgeRatio: 0.25,
          hedgeType: "speculative" as const,
          whyThisWorks:
            "Crypto stress events tend to widen downside reflexivity during drawdowns.",
        },
        {
          marketId: "pm-sp500-down-15-2026",
          side: "YES" as const,
          correlationStrength: 0.54,
          hedgeRatio: 0.2,
          hedgeType: "proxy" as const,
          whyThisWorks:
            "The non-obvious leg is broad risk-off, which often amplifies crypto downside.",
        },
      ],
    },
    {
      match: (text: string) =>
        text.includes("election-driven regulatory change") ||
        text.includes("policy-sensitive business"),
      exposure: "Policy-sensitive business exposed to election outcome and follow-on regulatory regime change.",
      summary:
        "Recognizes an election-policy mandate and maps it to political control plus downstream regulation risk.",
      searchSummary:
        "Shortlisted direct political-control contracts and a regulation-sensitive proxy sleeve.",
      skepticSummary:
        "Allows the sleeve because political control is directly hedgeable, but warns that regulation remains a thesis-level proxy.",
      acceptanceReason:
        "The committee approves this sleeve because election control is the direct policy driver and the supporting regulation leg captures the transmission into valuation risk.",
      dissentingView:
        "The skeptic notes that the regulation leg is only a proxy and should not be sized as if it were a direct hedge.",
      legs: [
        {
          marketId: "pm-gop-house-2026",
          side: "YES" as const,
          correlationStrength: 0.82,
          hedgeRatio: 0.45,
          hedgeType: "direct" as const,
          whyThisWorks:
            "Political control is the clearest event expression of regime change risk.",
        },
        {
          marketId: "pm-ai-reg-crackdown-2026",
          side: "YES" as const,
          correlationStrength: 0.56,
          hedgeRatio: 0.2,
          hedgeType: "proxy" as const,
          whyThisWorks:
            "This stands in for regulation-tightening momentum after a political shift.",
        },
      ],
    },
  ] as const;

  const scenario = scenarios.find((item) => item.match(lower));
  if (!scenario) return null;

  const recommendations = scenario.legs
    .map((leg) => {
      const market = findMarketById(allMarkets, leg.marketId);
      if (!market) return null;

      return {
        marketId: market.id,
        platform: market.platform,
        title: market.title,
        side: leg.side,
        correlationStrength: leg.correlationStrength,
        category: market.category,
        hedgeRatio: leg.hedgeRatio,
        reasoning: leg.whyThisWorks,
        confidence: Math.min(0.96, leg.correlationStrength),
        confidenceLevel: getConfidenceLevel(leg.correlationStrength),
        currentPrice: leg.side === "YES" ? market.yesPrice : market.noPrice,
        hedgeType: leg.hedgeType,
        protectsAgainst:
          inputType === "risk"
            ? description.trim()
            : scenario.exposure,
        whyThisWorks: leg.whyThisWorks,
        tradeoffs: getTradeoffText(leg.hedgeType),
        coverageEstimate: Math.min(0.92, leg.correlationStrength),
        suggestedSize: getSuggestedSize(leg.hedgeRatio, leg.correlationStrength),
        suggestedMaxLoss:
          getSuggestedSize(leg.hedgeRatio, leg.correlationStrength) *
          (leg.side === "YES" ? market.yesPrice : market.noPrice),
      } satisfies HedgeRecommendation;
    })
    .filter((value): value is HedgeRecommendation => value !== null);

  if (recommendations.length === 0) return null;

  const exposureSummary = buildExposureSummary(
    description,
    inputType,
    scenario.exposure
  );
  const parserOutput: HedgeRiskParseResponse = {
    detectedExposure: scenario.exposure,
    downsideScenario: exposureSummary.harmScenario,
    hedgeIntent: exposureSummary.hedgeIntent,
    riskFactors: exposureSummary.summary
      .toLowerCase()
      .split(" ")
      .filter((word) => word.length > 5)
      .slice(0, 4),
    targetCategories: Array.from(new Set(recommendations.map((rec) => rec.category))).slice(0, 5),
    timeHorizon: "demo mandate",
    searchQuery: description,
    summary: scenario.summary,
  };
  const searchOutput: HedgeSearchResponse = {
    summary: scenario.searchSummary,
    shortlist: recommendations.map((rec) => ({
      marketId: rec.marketId,
      title: rec.title,
      whyItMatters: rec.whyThisWorks,
      fitScore: rec.confidence,
    })),
  };
  const skepticOutput: HedgeSkepticResponse = {
    verdict: "accept",
    summary: scenario.skepticSummary,
    flaggedMarketIds: [],
    concerns: scenario.dissentingView ? [scenario.dissentingView] : [],
    acceptanceReason: scenario.acceptanceReason,
    confidence: "high",
    dissentingView: scenario.dissentingView,
  };

  return {
    recommendations,
    groups: groupRecommendations(recommendations),
    exposureSummary,
    committee: buildCommittee(
      exposureSummary,
      parserOutput,
      searchOutput,
      recommendations,
      skepticOutput,
      false
    ),
    defaultObjective,
    inputType,
    fallbackUsed: false,
    platformsUnavailable: [],
  };
}

function resolveShortlistedMarkets(
  searchOutput: HedgeSearchResponse,
  searchUniverse: NormalizedMarket[],
  topMarkets: NormalizedMarket[]
): NormalizedMarket[] {
  const seen = new Set<string>();
  const resolved: NormalizedMarket[] = [];

  for (const candidate of searchOutput.shortlist) {
    const market =
      findMarketById(searchUniverse, candidate.marketId) ??
      findMarketByTitle(searchUniverse, candidate.title, 0.8) ??
      findMarketById(topMarkets, candidate.marketId) ??
      findMarketByTitle(topMarkets, candidate.title, 0.8);
    if (market && !seen.has(market.id)) {
      seen.add(market.id);
      resolved.push(market);
    }
  }

  if (resolved.length > 0) return resolved;
  return topMarkets.slice(0, 12);
}

function applySkepticVerdict(
  recommendations: HedgeRecommendation[],
  skepticOutput: HedgeSkepticResponse
): HedgeRecommendation[] {
  if (skepticOutput.verdict === "accept" || skepticOutput.flaggedMarketIds.length === 0) {
    return recommendations;
  }

  const filtered = recommendations.filter(
    (rec) => !skepticOutput.flaggedMarketIds.includes(rec.marketId)
  );

  if (skepticOutput.verdict === "reject") {
    return filtered.slice(0, 1);
  }

  return filtered.length > 0 ? filtered : recommendations;
}

function buildHeuristicRiskParse(
  description: string,
  inputType: HedgeInputType,
  detectedExposure: string
): HedgeRiskParseResponse {
  const fallbackCategories =
    inputType === "crypto"
      ? ["crypto", "economics"]
      : inputType === "position"
        ? ["politics", "economics", "general"]
        : ["economics", "politics", "geopolitics"];

  return {
    detectedExposure,
    downsideScenario: description.trim(),
    hedgeIntent: "Find prediction-market contracts that appreciate when the described downside materializes.",
    riskFactors: fallbackCategories,
    targetCategories: fallbackCategories,
    timeHorizon: "near-term",
    searchQuery: description.trim(),
    summary: `Interprets the mandate as ${detectedExposure.toLowerCase()} and frames the hedge around ${description.trim().toLowerCase()}.`,
  };
}

function buildHeuristicSearch(
  parserOutput: HedgeRiskParseResponse,
  markets: NormalizedMarket[]
): HedgeSearchResponse {
  return {
    summary:
      markets.length > 0
        ? `Shortlisted ${Math.min(markets.length, 8)} prediction-market candidates around ${parserOutput.targetCategories.join(", ")}, with the top ideas chosen for directness and liquidity.`
        : "Did not find a strong enough set of prediction-market candidates to form a clean shortlist.",
    shortlist: markets.slice(0, 8).map((market, index) => ({
      marketId: market.id,
      title: market.title,
      whyItMatters:
        index === 0
          ? `Most relevant match to ${parserOutput.downsideScenario.toLowerCase()}.`
          : `Potential proxy to ${parserOutput.detectedExposure.toLowerCase()}.`,
      fitScore: Math.max(0.35, 0.9 - index * 0.08),
    })),
  };
}

function buildExpandedRiskProfile(
  description: string,
  parserOutput: HedgeRiskParseResponse
) {
  const lower = description.toLowerCase();
  const matched = CAUSAL_FACTOR_GRAPH.filter((entry) =>
    entry.keywords.some((keyword) => lower.includes(keyword))
  );

  const factors = Array.from(
    new Set([
      ...parserOutput.riskFactors,
      ...matched.flatMap((entry) => entry.factors),
    ])
  );
  const categories = Array.from(
    new Set([
      ...parserOutput.targetCategories,
      ...matched.flatMap((entry) => entry.categories),
    ])
  );
  const searchTerms = Array.from(
    new Set([
      parserOutput.searchQuery,
      parserOutput.detectedExposure,
      parserOutput.downsideScenario,
      ...factors,
      ...categories,
    ])
  );

  return { factors, categories, searchTerms };
}

function buildExpandedSearchUniverse(
  allMarkets: NormalizedMarket[],
  seedMarkets: NormalizedMarket[],
  expandedProfile: { factors: string[]; categories: string[]; searchTerms: string[] }
): NormalizedMarket[] {
  const seen = new Set<string>();
  const result: NormalizedMarket[] = [];

  function pushMarket(market: NormalizedMarket) {
    if (seen.has(market.id)) return;
    seen.add(market.id);
    result.push(market);
  }

  seedMarkets.forEach(pushMarket);

  const lowerTerms = expandedProfile.searchTerms.map((term) => term.toLowerCase());
  const titleMatches = allMarkets.filter((market) => {
    const haystack = `${market.title} ${market.description} ${market.category}`.toLowerCase();
    const termHits = lowerTerms.filter((term) => haystack.includes(term)).length;
    return termHits > 0 || expandedProfile.categories.includes(market.category);
  });

  titleMatches
    .sort((a, b) => b.volume24h + b.liquidity - (a.volume24h + a.liquidity))
    .slice(0, 24)
    .forEach(pushMarket);

  return result.slice(0, 32);
}

function buildCausalFallbackRecommendations(
  markets: NormalizedMarket[],
  expandedProfile: { factors: string[]; categories: string[]; searchTerms: string[] },
  exposureSummary: ExposureSummary
): HedgeRecommendation[] {
  const lowerTerms = expandedProfile.searchTerms.map((term) => term.toLowerCase());

  return markets
    .map((market) => {
      const haystack = `${market.title} ${market.description} ${market.category}`.toLowerCase();
      const termHits = lowerTerms.filter((term) => haystack.includes(term)).length;
      const categoryBoost = expandedProfile.categories.includes(market.category) ? 0.18 : 0;
      const liquidityBoost = Math.min(0.12, market.liquidity / 100000);
      const confidence = Math.min(0.86, 0.34 + termHits * 0.1 + categoryBoost + liquidityBoost);
      if (termHits === 0 && categoryBoost === 0) return null;

      return {
        marketId: market.id,
        platform: market.platform,
        title: market.title,
        side: "YES" as const,
        correlationStrength: confidence,
        category: market.category,
        hedgeRatio: Math.min(0.7, 0.28 + termHits * 0.08),
        reasoning: `Causal retry linked this market to ${expandedProfile.factors.slice(0, 2).join(" and ")} in the downside path.`,
        confidence,
        confidenceLevel: getConfidenceLevel(confidence),
        currentPrice: market.yesPrice,
        hedgeType: classifyRecommendationType(confidence),
        protectsAgainst: exposureSummary.harmScenario,
        whyThisWorks: `This contract matches the causal retry path through ${expandedProfile.factors.slice(0, 2).join(" and ")}.`,
        tradeoffs: getTradeoffText(classifyRecommendationType(confidence)),
        coverageEstimate: Math.min(0.84, confidence),
        suggestedSize: getSuggestedSize(0.4, confidence),
        suggestedMaxLoss: getSuggestedSize(0.4, confidence) * market.yesPrice,
      } satisfies HedgeRecommendation;
    })
    .filter((rec): rec is HedgeRecommendation => rec !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

function buildHeuristicSkeptic(
  recommendations: HedgeRecommendation[],
  fallbackUsed: boolean
): HedgeSkepticResponse {
  const speculativeCount = recommendations.filter(
    (rec) => rec.confidenceLevel === "speculative"
  ).length;
  const avgConfidence =
    recommendations.length > 0
      ? recommendations.reduce((sum, rec) => sum + rec.confidence, 0) /
        recommendations.length
      : 0;
  const verdict =
    recommendations.length === 0
      ? "reject"
      : fallbackUsed || speculativeCount > 1 || avgConfidence < 0.45
        ? "revise"
        : "accept";

  return {
    verdict,
    summary:
      verdict === "accept"
        ? "Accepts the sleeve because the top contracts are direct enough to take into execution review."
        : verdict === "revise"
          ? "Allows the sleeve with caution because basis risk and proxy dependence are still material."
          : "Rejects the sleeve because the mapping is too weak to present as a real hedge.",
    flaggedMarketIds:
      verdict === "accept"
        ? []
        : recommendations
            .filter((rec) => rec.confidenceLevel === "speculative")
            .map((rec) => rec.marketId),
    concerns: [
      fallbackUsed ? "Fallback path is active." : null,
      speculativeCount > 0
        ? `${speculativeCount} leg${speculativeCount === 1 ? "" : "s"} remain speculative.`
        : null,
      avgConfidence < 0.58 ? "Average sleeve confidence is only moderate." : null,
    ].filter(Boolean) as string[],
    acceptanceReason:
      verdict === "accept"
        ? "The skeptic accepts the sleeve because the directness of the top contracts is high enough to justify execution review."
        : verdict === "revise"
          ? "The skeptic allows a revised sleeve, but only if the user reviews basis risk and avoids over-sizing weak proxy legs."
          : "The skeptic does not approve the sleeve because the system has not found a defensible hedge mapping yet.",
    confidence:
      avgConfidence >= 0.72
        ? "high"
        : avgConfidence >= 0.5
          ? "medium"
          : "speculative",
    dissentingView:
      verdict === "accept"
        ? null
        : "The skeptic is worried the proposed sleeve may be directionally helpful in a demo but not resilient enough in a stressed market.",
  };
}
