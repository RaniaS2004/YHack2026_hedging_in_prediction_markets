import { z } from "zod";

export const HedgeRiskParseSchema = z.object({
  detectedExposure: z.string().describe("Normalized statement of what the user is exposed to"),
  downsideScenario: z.string().describe("Specific scenario that hurts the user"),
  hedgeIntent: z.string().describe("What the hedge should accomplish"),
  riskFactors: z.array(z.string()).max(8).describe("Key risk factors or drivers"),
  targetCategories: z.array(z.string()).max(5).describe("Market categories most relevant to the exposure"),
  timeHorizon: z.string().describe("Expected hedge horizon such as near-term, election cycle, or undefined"),
  searchQuery: z.string().describe("Condensed search query to use for market retrieval"),
  summary: z.string().describe("One sentence parser summary"),
});

export const HedgeSearchCandidateSchema = z.object({
  marketId: z.string().describe("The exact market ID from the provided market list"),
  title: z.string().describe("The market title"),
  whyItMatters: z.string().describe("Why this market could matter to the hedge"),
  fitScore: z.number().min(0).max(1).describe("Relative fit score from 0 to 1"),
});

export const HedgeSearchResponseSchema = z.object({
  summary: z.string().describe("One sentence summary of the search result"),
  shortlist: z.array(HedgeSearchCandidateSchema).max(12),
});

export const HedgeRecommendationSchema = z.object({
  marketId: z.string().describe("The exact market ID or ticker from the provided market list"),
  platform: z.enum(["polymarket", "kalshi", "limitless", "myriad", "opinion"]),
  title: z.string().describe("The market title"),
  side: z.enum(["YES", "NO"]).describe("Which side to buy for the hedge"),
  correlationStrength: z.number().min(0).max(1).describe("Estimated correlation strength between 0 and 1. 1 = perfectly correlated to the user's risk, 0 = unrelated"),
  category: z.string().describe("Category of this market (politics, trade, crypto, economics, tech, geopolitics, climate, sports, general)"),
  hedgeRatio: z.number().min(0).max(1).describe("Suggested hedge ratio. 1.0 = fully hedge, 0.5 = half hedge"),
  reasoning: z.string().describe("One sentence explaining why this contract hedges the user's risk"),
});

export const GrokHedgeResponseSchema = z.object({
  recommendations: z.array(HedgeRecommendationSchema).max(6),
  inputCategory: z.string().describe("The category of the user's input position/risk"),
  sleeveSummary: z.string().describe("One sentence summary of the proposed hedge sleeve"),
});

export const HedgeSkepticResponseSchema = z.object({
  verdict: z.enum(["accept", "revise", "reject"]).describe("Whether the hedge sleeve should be accepted, revised, or rejected"),
  summary: z.string().describe("One sentence skeptic summary"),
  flaggedMarketIds: z.array(z.string()).max(6).describe("Market IDs the skeptic thinks should be removed or treated carefully"),
  concerns: z.array(z.string()).max(5).describe("Main reasons for skepticism"),
  acceptanceReason: z.string().describe("Why the skeptic would still allow the sleeve or why it should be blocked"),
  confidence: z.enum(["high", "medium", "speculative"]),
  dissentingView: z.string().nullable().describe("Optional dissenting statement to show the user"),
});

export type GrokHedgeResponse = z.infer<typeof GrokHedgeResponseSchema>;
export type HedgeRiskParseResponse = z.infer<typeof HedgeRiskParseSchema>;
export type HedgeSearchResponse = z.infer<typeof HedgeSearchResponseSchema>;
export type HedgeSkepticResponse = z.infer<typeof HedgeSkepticResponseSchema>;
