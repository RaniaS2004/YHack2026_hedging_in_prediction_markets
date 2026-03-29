import { describe, it, expect } from "vitest";
import { computePayoffTable, calculateHedgeSize } from "../payoff";
import { SagaLeg } from "@/types";

function makeLeg(overrides: Partial<SagaLeg> = {}): SagaLeg {
  return {
    id: "leg-1",
    sagaId: "saga-1",
    platform: "polymarket",
    marketId: "market-1",
    marketTitle: "Test Market",
    side: "YES",
    size: 10,
    price: 0.6,
    fillPrice: 0.6,
    status: "FILLED",
    simulated: false,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

describe("computePayoffTable", () => {
  it("returns empty for no legs", () => {
    const result = computePayoffTable([]);
    expect(result.scenarios).toHaveLength(0);
    expect(result.bestCase).toBe(0);
    expect(result.worstCase).toBe(0);
  });

  it("computes correct P&L for single YES leg", () => {
    // Buy 10 YES shares at $0.60 each. Cost = $6.
    // If YES: pays 10 * $1 = $10. P&L = $10 - $6 = $4
    // If NO: pays 10 * $0 = $0. P&L = $0 - $6 = -$6
    const leg = makeLeg({ side: "YES", size: 10, price: 0.6, fillPrice: 0.6 });
    const result = computePayoffTable([leg]);

    expect(result.scenarios).toHaveLength(2);

    const noScenario = result.scenarios.find(
      (s) => s.outcomes["market-1"] === "NO"
    );
    const yesScenario = result.scenarios.find(
      (s) => s.outcomes["market-1"] === "YES"
    );

    expect(noScenario!.netPnl).toBe(-6);
    expect(yesScenario!.netPnl).toBe(4);
  });

  it("computes correct P&L for two-leg hedge", () => {
    // Leg 1: 10 YES on market-1 at $0.60. Cost = $6.
    // Leg 2: 6 NO on market-2 at $0.40. Cost = $2.40.
    // Total cost = $8.40
    const leg1 = makeLeg({
      id: "leg-1",
      marketId: "market-1",
      marketTitle: "Market A",
      side: "YES",
      size: 10,
      price: 0.6,
      fillPrice: 0.6,
    });
    const leg2 = makeLeg({
      id: "leg-2",
      marketId: "market-2",
      marketTitle: "Market B",
      side: "NO",
      size: 6,
      price: 0.4,
      fillPrice: 0.4,
    });

    const result = computePayoffTable([leg1, leg2]);
    expect(result.scenarios).toHaveLength(4); // 2^2
  });

  it("handles all-YES scenario", () => {
    const leg = makeLeg({ side: "YES", size: 5, price: 0.5, fillPrice: 0.5 });
    const result = computePayoffTable([leg]);

    const yesScenario = result.scenarios.find(
      (s) => s.outcomes["market-1"] === "YES"
    );
    // 5 shares * $1 - 5 * $0.5 = $5 - $2.5 = $2.5
    expect(yesScenario!.netPnl).toBe(2.5);
  });

  it("handles all-NO scenario", () => {
    const leg = makeLeg({ side: "NO", size: 5, price: 0.3, fillPrice: 0.3 });
    const result = computePayoffTable([leg]);

    const noScenario = result.scenarios.find(
      (s) => s.outcomes["market-1"] === "NO"
    );
    // NO side pays $1 when outcome is NO. 5 * $1 - 5 * $0.3 = $5 - $1.5 = $3.5
    expect(noScenario!.netPnl).toBe(3.5);
  });

  it("handles zero fillPrice gracefully", () => {
    const leg = makeLeg({ price: 0, fillPrice: 0 });
    const result = computePayoffTable([leg]);
    // Should not throw, P&L should be computed
    expect(result.scenarios).toHaveLength(2);
  });
});

describe("calculateHedgeSize", () => {
  it("calculates correct hedge size", () => {
    // Need to offset $6 loss. Hedge pays $1 per share on YES outcome.
    const size = calculateHedgeSize(6, "YES", "YES");
    expect(size).toBe(6);
  });

  it("returns 0 when payoff is 0 (divide-by-zero guard)", () => {
    // YES side pays $0 when outcome is NO
    const size = calculateHedgeSize(6, "YES", "NO");
    expect(size).toBe(0);
  });
});
