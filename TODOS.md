# TODOS

## Post-Hackathon

### P2: Real Cross-Platform Execution (Saga Pattern)
Currently Kalshi execution is simulated. When Kalshi execution becomes real, the saga pattern needs real rollback logic across two different settlement systems (USDC on Polygon vs USD on Kalshi).
- **Why:** Core value prop for the startup is cross-platform atomic hedging
- **Effort:** L (human: ~2 weeks / CC: ~2-3 hours)
- **Depends on:** Kalshi API access verification, legal review of broker-dealer classification
- **Context:** The saga pattern is already built for the hackathon (with simulated Kalshi side). This TODO is about making the Kalshi side real, which requires solving the liquidity bridge problem and getting legal clarity.

### P2: Historical Correlation Data Pipeline
Build a data pipeline to compute rolling Pearson correlations between Polymarket contract prices. Currently confidence scores rely entirely on LLM semantic analysis when historical data is unavailable.
- **Why:** Empirical correlation data would dramatically improve hedge quality
- **Effort:** M (human: ~1 week / CC: ~1-2 hours)
- **Depends on:** Polymarket historical price data availability

### P3: Proper User Authentication
Replace bearer token with real auth (wallet connect, OAuth, or similar). Required before any public launch.
- **Why:** Current auth is a shared secret in an env var
- **Effort:** M (human: ~3 days / CC: ~30 min)

### P3: Crypto Position Input Mode
Add support for crypto/spot/perps positions as input (e.g., "I'm long 10 ETH"). Requires CoinGecko API integration and mapping crypto exposure to prediction market hedges.
- **Why:** Maps to Polymarket's hackathon example idea #1 (Leveraged Perps + Prediction Market Hedge)
- **Effort:** S (human: ~2 days / CC: ~30 min)

### P3: Animated Payoff Curve Transitions
When user adds a hedge, animate the payoff chart from "high risk" to "hedged" state. Recharts supports animated transitions.
- **Why:** Visual wow factor for judges and users
- **Effort:** S (human: ~1 day / CC: ~20 min)

### P3: Confidence Score Calibration Pipeline
Track hedge outcomes vs. confidence scores over time. Compare predicted confidence categories (high/medium/speculative) against actual hedge performance. Use this data to recalibrate the 0.70/0.45 thresholds and weight formula.
- **Why:** Current confidence scores are LLM-estimated with no ground truth. Without calibration, "high confidence" badges may mislead users. This is the path from "LLM vibes" to "empirically validated."
- **Effort:** M (human: ~1 week / CC: ~1 hour)
- **Depends on:** Real users making real trades, outcome data collection
- **Context:** Eng review outside voice flagged that the confidence formula (0.7*semantic + 0.3*category) has no calibration data. Post-hackathon, log every hedge recommendation + its confidence score + whether the hedge actually reduced risk when the market resolved. Run regression to find optimal weights and thresholds.

### P3: Multi-User Wallet Binding
Add support for users to connect their own Polymarket wallets (WalletConnect or similar) and Kalshi API credentials, so each user can view their own positions and execute hedges from their own accounts. Currently the app reads from a single wallet configured via env var.
- **Why:** Core requirement for multi-user product. Without this, every user sees the operator's positions.
- **Effort:** M (human: ~1 week / CC: ~1 hour)
- **Depends on:** Proper User Authentication (P3), Polymarket WalletConnect integration docs
- **Context:** Eng review outside voice flagged that GET /api/positions requires wallet connection, not just an API key. For Polymarket, this means either WalletConnect for browser wallets or reading on-chain CTF exchange contract data. For Kalshi, this means API key storage per user. Related to but separate from the auth TODO, which covers session management. This TODO covers the platform credential binding specifically.
