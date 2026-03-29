# CLAUDE.md

## Project

**HedgeKit** — AI-powered cross-platform prediction market hedging engine. YHack 2026.

## Development Setup

```bash
npm install          # install dependencies
npm run dev          # start dev server (http://localhost:3000)
npm run build        # production build
npm test             # run tests (vitest)
```

Env vars needed in `.env.local`:
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — Supabase project
- `GROK_API_KEY` — xAI Grok API key
- `AUTH_TOKEN` — Bearer token for API auth (default: hedgehog-dev-token)
- `POLYMARKET_API_KEY`, `POLYMARKET_PRIVATE_KEY` — Polymarket CLOB (optional for dev)
- `KALSHI_API_KEY`, `KALSHI_PRIVATE_KEY` — Kalshi API (optional for dev)

## Tech Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **Supabase** (PostgreSQL + Edge Functions + Cron)
- **Grok API** via OpenAI SDK (model: grok-4-1-fast-non-reasoning)
- **Polymarket CLOB API** (real execution)
- **Kalshi API** (real data, simulated execution)
- **CoinGecko API** (crypto prices)
- **Recharts** (payoff visualization)
- **Vitest** (testing)

## Architecture

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Dashboard
│   ├── hedge/page.tsx            # Hedge Recommendations
│   ├── execute/[sagaId]/page.tsx # Execution Status
│   └── api/
│       ├── markets/route.ts      # GET market data
│       ├── hedge/
│       │   ├── recommend/route.ts # POST hedge discovery
│       │   └── execute/route.ts   # POST saga creation
│       └── execution/
│           └── [sagaId]/route.ts  # GET saga status
├── lib/
│   ├── markets/                  # Market data (Polymarket, Kalshi, samples)
│   ├── llm/                      # Grok hedge discovery pipeline
│   ├── execution/                # Saga state machine
│   ├── analysis/                 # Payoff math
│   ├── db/                       # Supabase client
│   └── auth.ts                   # Bearer token auth + rate limiting
├── components/                   # UI components
└── types/                        # TypeScript types
```

## Key Patterns

- All API routes require `Authorization: Bearer <AUTH_TOKEN>` header
- Market data from 6 platforms: Polymarket + Kalshi (real), 4 others (sample data)
- Execution: real on Polymarket only, simulated on all others
- Saga pattern: PENDING → EXECUTING → COMPLETED | ROLLING_BACK → ROLLED_BACK | FAILED
- $25 per-saga spending cap
- Grok structured output with Zod validation for hedge recommendations

## gstack

Use `/browse` for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`.

If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.
