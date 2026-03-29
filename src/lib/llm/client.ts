import OpenAI from "openai";

// Primary: OpenAI (reliable structured output)
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const OPENAI_MODEL = "gpt-4o-mini";

// Grok fallback (for hedge discovery where structured output is less critical)
export const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export const GROK_MODEL = "grok-4-1-fast-non-reasoning";
