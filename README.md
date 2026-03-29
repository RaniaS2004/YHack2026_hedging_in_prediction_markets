# HedgeKit

Prediction-market-native hedging workstation for event books, crypto exposure, and external real-world risk.

HedgeKit is built around one core idea: the hedge overlay itself should be expressed in prediction market contracts. The product takes a mandate, parses the downside, searches markets across venues, constructs a hedge sleeve, runs a skeptic pass, shows before-versus-after risk, and only then moves into one-click execution.

## Live demo

Production deployment: [y-hack2026-hedging-in-prediction-markets-49m8idizm.vercel.app](https://y-hack2026-hedging-in-prediction-markets-49m8idizm.vercel.app)

## What it does

- Hedges prediction market positions with other prediction market contracts
- Translates external risk, like tariffs, elections, regulation, oil shocks, into executable event-market sleeves
- Builds sleeves with direct hedges, proxy legs, and non-obvious second-order overlays
- Shows portfolio-level intake, selected-line hedging, and on-book hedge monitoring
- Includes a cross-venue arbitrage scanner framed as market intelligence, not the main product

## Product surfaces

### `/`

Marketing homepage. Explains the product in one sentence and shows a desk-style before/after hedge visual.

### `/hedge`

Main hedge workstation.

Features:

- mandate intake for:
  - prediction-market positions
  - external/business risk
  - crypto or macro books
- structured hedge committee flow
- objective selection
- grouped hedge sleeves
- payoff and ticket review
- one-click execution handoff

### `/portfolio`

Portfolio workstation.

Features:

- account-linking simulation for Polymarket, Kalshi, and Limitless
- hedge the whole book or selected lines
- local persistence of connected accounts and executed hedge sleeves
- before/after portfolio overlay chart
- existing sleeve monitoring

### `/arbitrage`

Arbitrage and pricing-context surface.

Features:

- market scan across venues
- spread table
- opportunity selection and execution handoff

## Architecture

### Frontend

- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- Recharts for charts

### Backend / app logic

- App Router API routes under `src/app/api`
- OpenAI SDK for structured agent stages
- local heuristic fallback and seeded market universe for demo reliability
- saga-style execution model for multi-leg trades
- local portfolio state persisted in browser storage

### Core pipeline

The hedge engine lives in [hedge-discovery.ts](/Users/rania/Desktop/YHACK2026/YHack2026_hedging_in_prediction_markets/src/lib/llm/hedge-discovery.ts).

Current flow:

1. Risk parser agent normalizes the mandate
2. Market search agent shortlists relevant contracts
3. Constructor agent builds a sleeve
4. Skeptic agent attacks weak mappings
5. Causal retry / salvage logic expands factors and retries if the first pass is weak
6. Committee decision is rendered in the UI

This is a hybrid system:

- live venue market fetch where available
- structured agent reasoning
- heuristic retry logic
- curated demo sleeves for hackathon reliability

## Market coverage

### Live / fetched

- Polymarket
- Kalshi
- Limitless

### Seeded / simulated support

- Myriad
- Opinion
- extra seeded Polymarket and Kalshi contracts for demo coverage and fallback reliability

## Execution model

Execution uses a saga model from [saga.ts](/Users/rania/Desktop/YHACK2026/YHack2026_hedging_in_prediction_markets/src/lib/execution/saga.ts).

Status flow:

- `PENDING`
- `EXECUTING`
- `COMPLETED`
- `ROLLING_BACK`
- `ROLLED_BACK`
- `FAILED`

Current behavior:

- real execution is wired for the Polymarket executor path
- other venues are simulated or demo-oriented
- UI clearly tracks simulated versus real legs

## Local development

Install and run:

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run lint
npm run build
npm test
```

## Environment variables

Minimum required for the main hedge flow:

- `OPENAI_API_KEY`
- `AUTH_TOKEN`

Needed when using database-backed paths:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Optional venue credentials:

- `KALSHI_API_KEY`
- `KALSHI_PRIVATE_KEY_BASE64`
- `LIMITLESS_API_KEY`
- `POLYMARKET_API_KEY`
- `POLYMARKET_PRIVATE_KEY`
- `GROK_API_KEY`

## Vercel deployment

Before deploying:

1. Add the required environment variables in Vercel project settings
2. Do not upload `.env.local`
3. Rotate any secrets or private keys that were exposed in local development

Notes:

- `npm run lint` is scoped to `src`, so bundled tool directories do not block CI
- external web-font fetches were removed from the app shell to make builds safer in restricted environments
- if a local `next build` fails inside a constrained sandbox, that does not automatically mean Vercel will fail the same way

## Repo layout

```text
src/
  app/
    api/
      arbitrage/scan/route.ts
      execution/[sagaId]/route.ts
      hedge/execute/route.ts
      hedge/feedback/route.ts
      hedge/recommend/route.ts
      markets/route.ts
    arbitrage/page.tsx
    execute/[sagaId]/page.tsx
    hedge/page.tsx
    portfolio/page.tsx
    layout.tsx
    page.tsx
  components/
    HedgeCard.tsx
    PayoffChart.tsx
    PayoffTable.tsx
    SpreadTable.tsx
    ArbCard.tsx
  lib/
    agents/
    analysis/
    db/
    execution/
    llm/
    markets/
    portfolio/
  types/
```

## Known limitations

- the hedge engine is improved, but still hybrid. Some demo paths are curated for reliability
- venue coverage is only as good as the fetched and normalized market universe
- the arbitrage scanner still trades off depth for speed
- portfolio state is local-storage based, not multi-user persistent auth

## Demo path

Best demo sequence:

1. Homepage
2. Hedge workstation with a preset or strong external-risk mandate
3. Show the committee logic and non-obvious proxy leg
4. Execute a sleeve
5. Open portfolio and show the hedge now monitored on book

## Design source of truth

Design system notes live in [DESIGN.md](/Users/rania/Desktop/YHACK2026/YHack2026_hedging_in_prediction_markets/DESIGN.md).

## License / hackathon note

This repo is currently hackathon-stage software. Expect a mix of real integrations, simulated venue paths, and product-focused demo logic.
