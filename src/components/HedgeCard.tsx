"use client";

import { useState } from "react";
import {
  HedgeObjective,
  HedgeProtectionLevel,
  HedgeRecommendation,
} from "@/types";
import ConfidenceBadge from "./ConfidenceBadge";
import PlatformBadge from "./PlatformBadge";

const AUTH_TOKEN = "hedgehog-dev-token";

interface HedgeCardProps {
  recommendation: HedgeRecommendation;
  selected: boolean;
  onToggle: () => void;
  objective: HedgeObjective;
  protectionLevel: HedgeProtectionLevel;
  executionSize: number;
}

const OBJECTIVE_LABELS: Record<HedgeObjective, string> = {
  protect_downside: "Downside protection",
  reduce_volatility: "Volatility reduction",
  offset_scenario: "Scenario offset",
};

const TYPE_LABELS = {
  direct: "Direct hedge",
  proxy: "Proxy hedge",
  speculative: "Speculative",
} as const;

export default function HedgeCard({
  recommendation: rec,
  selected,
  onToggle,
  objective,
  protectionLevel,
  executionSize,
}: HedgeCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  async function handleFeedback(vote: "up" | "down", e: React.MouseEvent) {
    e.stopPropagation();
    if (feedback === vote) return;
    setFeedback(vote);
    try {
      await fetch("/api/hedge/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        body: JSON.stringify({
          recommendationId: `${rec.platform}-${rec.marketId}`,
          marketId: rec.marketId,
          platform: rec.platform,
          vote,
        }),
      });
    } catch {
      // Best-effort for hackathon
    }
  }

  function toggleDetails(e: React.MouseEvent) {
    e.stopPropagation();
    setShowDetails((prev) => !prev);
  }

  const isNonObviousProxy =
    rec.hedgeType === "proxy" &&
    /non-obvious|second-order|spillover|risk-off/i.test(rec.whyThisWorks);
  const compactWhyThisWorks =
    rec.whyThisWorks.length > 120
      ? `${rec.whyThisWorks.slice(0, 117).trimEnd()}...`
      : rec.whyThisWorks;

  return (
    <div
      onClick={onToggle}
      className={`cursor-pointer rounded-2xl border p-3.5 transition-all duration-150 ${
        selected
          ? "border-[#6366F1] bg-[#6366F1]/[0.03] shadow-[0_0_0_1px_rgba(99,102,241,0.15)]"
          : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
      }`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <PlatformBadge platform={rec.platform} />
            <span className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">
              {TYPE_LABELS[rec.hedgeType]}
            </span>
            <span className="rounded-full border border-[#10B981]/20 bg-[#10B981]/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#059669]">
              {Math.round(rec.coverageEstimate * 100)}% coverage
            </span>
            {isNonObviousProxy && (
              <span className="rounded-full border border-[#F59E0B]/30 bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#B45309]">
                Non-obvious proxy
              </span>
            )}
          </div>
          <h3 className="text-[14px] font-semibold leading-snug text-[#0F172A]">
            {rec.title}
          </h3>
        </div>
        <ConfidenceBadge
          confidence={rec.confidence}
          level={rec.confidenceLevel}
        />
      </div>

      <p className="mb-2.5 text-[12px] leading-relaxed text-[#64748B]">
        Protects if {rec.protectsAgainst}
      </p>

      <div className="mb-2.5 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
            Position
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[#0F172A]">
            {rec.side} @ ${rec.currentPrice.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
            Suggested Size
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[#0F172A]">
            {executionSize} contracts
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
            Max Spend
          </p>
          <p className="mt-1 text-[12px] font-semibold text-[#0F172A]">
            ${Math.round(executionSize * rec.currentPrice)}
          </p>
        </div>
      </div>

      <div className="mb-2.5 rounded-xl border border-[#E2E8F0] bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-[#0F172A]">
            Built for {OBJECTIVE_LABELS[objective].toLowerCase()}
          </p>
          <p className="text-[11px] font-medium text-[#64748B] capitalize">
            {protectionLevel} hedge
          </p>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">
          {compactWhyThisWorks}
        </p>
        {isNonObviousProxy && (
          <div className="mt-2 rounded-xl border border-[#FDE68A]/50 bg-[#FFFBEB] px-3 py-2">
            <p className="text-[11px] font-semibold text-[#92400E]">
              This is the magic leg
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#92400E]">
              It is not the direct event contract. It captures the second-order market stress that usually follows the main downside scenario.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={toggleDetails}
        className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[#6366F1] transition-colors hover:text-[#4F46E5]"
      >
        <svg
          className={`h-3 w-3 transition-transform ${showDetails ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        Hedge details
      </button>

      {showDetails && (
        <div className="mb-2.5 space-y-2 rounded-xl border border-[#6366F1]/10 bg-[#6366F1]/[0.02] p-3 text-[12px] leading-relaxed text-[#475569]">
          <p>
            <span className="font-semibold text-[#0F172A]">Tradeoff:</span>{" "}
            {rec.tradeoffs}
          </p>
          <p>
            <span className="font-semibold text-[#0F172A]">
              Correlation / hedge ratio:
            </span>{" "}
            {Math.round(rec.correlationStrength * 100)}% /{" "}
            {Math.round(rec.hedgeRatio * 100)}%
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 font-mono text-[10px] text-[#94A3B8]">
          <span className="capitalize">{rec.category}</span>
          <span className="text-[#E2E8F0]">|</span>
          <span>{rec.suggestedSize} base</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={(e) => handleFeedback("up", e)}
            className={`rounded-md p-1.5 transition-all ${
              feedback === "up"
                ? "bg-[#22C55E]/10 text-[#22C55E]"
                : "text-[#E2E8F0] hover:bg-[#22C55E]/5 hover:text-[#22C55E]"
            }`}
            title="Good recommendation"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"
              />
            </svg>
          </button>
          <button
            onClick={(e) => handleFeedback("down", e)}
            className={`rounded-md p-1.5 transition-all ${
              feedback === "down"
                ? "bg-[#EF4444]/10 text-[#EF4444]"
                : "text-[#E2E8F0] hover:bg-[#EF4444]/5 hover:text-[#EF4444]"
            }`}
            title="Bad recommendation"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
