"use client";

import { ArbOpportunity } from "@/types";
import PlatformBadge from "./PlatformBadge";

interface ArbCardProps {
  arb: ArbOpportunity;
  selected: boolean;
  onToggle: () => void;
}

export default function ArbCard({ arb, selected, onToggle }: ArbCardProps) {
  const profitPct = (arb.profitMargin * 100).toFixed(1);

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left rounded-xl border p-5 transition-all duration-150 ${
        selected
          ? "border-[#6366F1] bg-[#6366F1]/[0.03] shadow-[0_0_0_1px_#6366F1]"
          : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold mb-2 ${
              arb.arbType === "PRICE_DIVERGENCE"
                ? "bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20"
                : "bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/20"
            }`}
          >
            {arb.arbType === "PRICE_DIVERGENCE"
              ? "Price Divergence"
              : "Complementary"}
          </span>
        </div>
        <div
          className={`rounded-lg px-3 py-1.5 text-center ${
            parseFloat(profitPct) >= 5
              ? "bg-[#22C55E]/10 border border-[#22C55E]/20"
              : parseFloat(profitPct) >= 2
              ? "bg-[#F59E0B]/10 border border-[#F59E0B]/20"
              : "bg-[#94A3B8]/10 border border-[#94A3B8]/20"
          }`}
        >
          <p
            className={`text-[18px] font-bold font-mono ${
              parseFloat(profitPct) >= 5
                ? "text-[#22C55E]"
                : parseFloat(profitPct) >= 2
                ? "text-[#F59E0B]"
                : "text-[#64748B]"
            }`}
          >
            +{profitPct}%
          </p>
          <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider">
            Profit
          </p>
        </div>
      </div>

      {/* Buy Side */}
      <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#22C55E] uppercase">
              Buy
            </span>
            <PlatformBadge platform={arb.buyPlatform} />
          </div>
          <span className="text-[13px] font-mono font-semibold text-[#0F172A]">
            {arb.buySide} @ ${arb.buyPrice.toFixed(2)}
          </span>
        </div>
        <p className="text-[12px] text-[#64748B] mt-1 truncate">
          {arb.buyMarketTitle}
        </p>
      </div>

      {/* Sell Side */}
      <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#EF4444] uppercase">
              Sell
            </span>
            <PlatformBadge platform={arb.sellPlatform} />
          </div>
          <span className="text-[13px] font-mono font-semibold text-[#0F172A]">
            {arb.sellSide} @ ${arb.sellPrice.toFixed(2)}
          </span>
        </div>
        <p className="text-[12px] text-[#64748B] mt-1 truncate">
          {arb.sellMarketTitle}
        </p>
      </div>

      {selected && (
        <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
          <p className="text-[12px] text-[#6366F1] font-medium">
            Selected for execution
          </p>
        </div>
      )}
    </button>
  );
}
