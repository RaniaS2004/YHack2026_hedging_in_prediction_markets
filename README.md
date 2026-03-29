# YHack2026_hedging_in_prediction_markets

## Vercel deploy checklist

Set these environment variables in Vercel before deploying:

- `OPENAI_API_KEY`
- `AUTH_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `KALSHI_API_KEY` if you want live Kalshi fetches
- `KALSHI_PRIVATE_KEY_BASE64` if you want authenticated Kalshi actions
- `LIMITLESS_API_KEY` if you want live Limitless fetches
- `POLYMARKET_API_KEY` and `POLYMARKET_PRIVATE_KEY` only if you wire live trading

Notes:

- Do not upload `.env.local` directly.
- Rotate any secrets that were exposed during local development.
- `npm run lint` is scoped to `src` so bundled tool folders do not block CI.
