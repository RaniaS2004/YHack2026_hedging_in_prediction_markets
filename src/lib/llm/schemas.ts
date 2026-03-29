import { z } from "zod";

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
});

export type GrokHedgeResponse = z.infer<typeof GrokHedgeResponseSchema>;
