# CLAUDE.md

## Project

**HedgeKit** is a prediction-market-native hedging workstation built for YHack 2026.

The core product is not an arbitrage app. The core product is hedging:

- hedge prediction market positions
- hedge crypto or macro books
- hedge external business or real-world risk
- express the overlay using prediction market contracts

## Development setup

```bash
npm install
npm run dev
npm run lint
npm run build
npm test
```

## Required env vars

Core:

- `OPENAI_API_KEY`
- `AUTH_TOKEN`

Database-backed paths:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Optional venue / model integrations:

- `GROK_API_KEY`
- `KALSHI_API_KEY`
- `KALSHI_PRIVATE_KEY_BASE64`
- `LIMITLESS_API_KEY`
- `POLYMARKET_API_KEY`
- `POLYMARKET_PRIVATE_KEY`

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- OpenAI SDK
- Recharts
- Supabase
- Vitest

## Architecture

```text
src/
├── app/
│   ├── page.tsx                  # homepage
│   ├── hedge/page.tsx            # hedge workstation
│   ├── portfolio/page.tsx        # portfolio workstation
│   ├── arbitrage/page.tsx        # market-intelligence / arb page
│   ├── execute/[sagaId]/page.tsx # execution status
│   └── api/
│       ├── hedge/recommend/route.ts
│       ├── hedge/execute/route.ts
│       ├── hedge/feedback/route.ts
│       ├── arbitrage/scan/route.ts
│       ├── markets/route.ts
│       └── execution/[sagaId]/route.ts
├── components/
├── lib/
│   ├── agents/
│   ├── analysis/
│   ├── db/
│   ├── execution/
│   ├── llm/
│   ├── markets/
│   └── portfolio/
└── types/
```

## Hedge engine

Main file: `src/lib/llm/hedge-discovery.ts`

Current hedge pipeline:

1. Parse mandate into a structured risk brief
2. Search live and seeded market universe
3. Construct a sleeve
4. Run skeptic review
5. Retry via causal-factor expansion if the first pass is weak
6. Return committee decision + grouped recommendations

This is a hybrid system:

- live market fetch where possible
- structured agent stages
- heuristic and causal retry logic
- curated demo sleeves for reliability

## Product notes

- Homepage is marketing-led
- `/hedge` is the main product
- `/portfolio` simulates connected venue books and sleeve monitoring
- `/arbitrage` is positioned as market intelligence, not the main story

## Execution notes

- multi-leg execution uses a saga model
- real execution path is primarily modeled around Polymarket
- simulated legs remain visible in the UI

## Repo notes

- `npm run lint` is intentionally scoped to `src`
- remote web-font dependencies were removed from the app shell for safer builds
- if local secrets were exposed during development, rotate them before sharing or deploying

## gstack note

Use the vendored gstack skills already present in the repo when explicitly requested.
