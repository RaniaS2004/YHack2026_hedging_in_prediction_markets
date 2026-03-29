"use client";

import { PayoffTable as PayoffTableType } from "@/types";

interface PayoffTableProps {
  payoff: PayoffTableType;
}

export default function PayoffTable({ payoff }: PayoffTableProps) {
  if (payoff.scenarios.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] p-4 text-[13px] text-[#94A3B8]">
        Select hedge contracts to see payoff scenarios.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <h3 className="text-[13px] font-semibold text-[#0F172A]">
          Payoff Scenarios
        </h3>
        <p className="text-[11px] text-[#94A3B8] mt-0.5">
          {payoff.scenarios.length} scenarios, {payoff.legs.length}{" "}
          contract{payoff.legs.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              <th className="px-4 py-2.5 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-[0.05em]">
                Scenario
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-medium text-[#94A3B8] uppercase tracking-[0.05em]">
                Net P&L
              </th>
            </tr>
          </thead>
          <tbody>
            {payoff.scenarios.map((scenario, i) => (
              <tr
                key={i}
                className="border-b border-[#E2E8F0] last:border-b-0 transition-colors duration-150 hover:bg-[#F8FAFC]"
              >
                <td className="px-4 py-2.5 text-[12px] text-[#64748B]">
                  {scenario.label}
                </td>
                <td
                  className={`px-4 py-2.5 text-right text-[12px] font-semibold font-mono ${
                    scenario.netPnl > 0
                      ? "text-[#059669]"
                      : scenario.netPnl < 0
                        ? "text-[#DC2626]"
                        : "text-[#94A3B8]"
                  }`}
                >
                  {scenario.netPnl >= 0 ? "+" : ""}${scenario.netPnl.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 text-[11px] font-mono">
        <span className="text-[#059669] font-semibold">
          Best: +${payoff.bestCase.toFixed(2)}
        </span>
        <span className="text-[#DC2626] font-semibold">
          Worst: ${payoff.worstCase.toFixed(2)}
        </span>
      </div>
    </div>
  );
}
