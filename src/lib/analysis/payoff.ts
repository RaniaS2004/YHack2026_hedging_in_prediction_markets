import { PayoffScenario, PayoffTable, SagaLeg } from "@/types";

/**
 * Compute a discrete payoff table for binary prediction market contracts.
 *
 * Each contract pays $1 for YES or $0 for NO.
 * Enumerate all 2^n outcome combinations for n legs.
 * For each scenario, compute net P&L = sum of (payoff - cost) per leg.
 */
export function computePayoffTable(legs: SagaLeg[]): PayoffTable {
  if (legs.length === 0) {
    return { scenarios: [], legs: [], bestCase: 0, worstCase: 0 };
  }

  const n = legs.length;
  const totalScenarios = Math.pow(2, n);
  const scenarios: PayoffScenario[] = [];

  for (let i = 0; i < totalScenarios; i++) {
    const outcomes: Record<string, "YES" | "NO"> = {};
    const labels: string[] = [];
    let netPnl = 0;

    for (let j = 0; j < n; j++) {
      const leg = legs[j];
      const outcomeIsYes = Boolean(i & (1 << j));
      const outcome = outcomeIsYes ? "YES" : "NO";
      outcomes[leg.marketId] = outcome;

      // Short label for this leg's outcome
      const shortTitle =
        leg.marketTitle.length > 30
          ? leg.marketTitle.slice(0, 30) + "..."
          : leg.marketTitle;
      labels.push(`${shortTitle}: ${outcome}`);

      // Calculate P&L for this leg
      const cost = leg.size * (leg.fillPrice ?? leg.price ?? 0);
      const payoffPerShare = computePayoffPerShare(leg.side, outcome);
      const payoff = leg.size * payoffPerShare;

      netPnl += payoff - cost;
    }

    scenarios.push({
      outcomes,
      netPnl: Math.round(netPnl * 100) / 100, // round to cents
      label: labels.join(" | "),
    });
  }

  const pnls = scenarios.map((s) => s.netPnl);

  return {
    scenarios,
    legs,
    bestCase: Math.max(...pnls),
    worstCase: Math.min(...pnls),
  };
}

/**
 * What does one share pay out given the leg's side and the actual outcome?
 *
 * If you hold YES and outcome is YES: pays $1
 * If you hold YES and outcome is NO: pays $0
 * If you hold NO and outcome is YES: pays $0
 * If you hold NO and outcome is NO: pays $1
 */
function computePayoffPerShare(
  side: "YES" | "NO",
  outcome: "YES" | "NO"
): number {
  if (side === outcome) return 1;
  return 0;
}

/**
 * Calculate hedge size: how many shares of contract B to buy
 * to offset a given dollar loss on contract A.
 *
 * hedgeShares = lossToOffset / payoffPerShare
 *
 * Guard: if payoffPerShare is 0, return 0 (can't hedge with a contract that doesn't pay out)
 */
export function calculateHedgeSize(
  lossToOffset: number,
  hedgeSide: "YES" | "NO",
  hedgeOutcome: "YES" | "NO"
): number {
  const payoff = computePayoffPerShare(hedgeSide, hedgeOutcome);
  if (payoff === 0) return 0;
  return lossToOffset / payoff;
}
