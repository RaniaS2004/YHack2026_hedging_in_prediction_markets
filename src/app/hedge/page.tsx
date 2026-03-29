"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import HedgeCard from "@/components/HedgeCard";
import PayoffTable from "@/components/PayoffTable";
import PayoffChart from "@/components/PayoffChart";
import {
  HedgeDiscoveryResult,
  HedgeObjective,
  HedgeProtectionLevel,
  SagaLeg,
  PayoffTable as PayoffTableType,
} from "@/types";
import { computePayoffTable } from "@/lib/analysis/payoff";
import { addPortfolioHedge } from "@/lib/portfolio/account-store";

const AUTH_TOKEN = "hedgehog-dev-token";

type IntakeKind = "prediction_market" | "external_risk" | "crypto_macro";
type ReviewMode = "analysis" | "execution";
type PositionSide = "YES" | "NO";

const OBJECTIVES: {
  id: HedgeObjective;
  title: string;
  description: string;
}[] = [
  {
    id: "protect_downside",
    title: "Protect downside",
    description: "Run a more defensive overlay against the main loss scenario.",
  },
  {
    id: "reduce_volatility",
    title: "Reduce volatility",
    description: "Smooth swings while leaving more upside intact.",
  },
  {
    id: "offset_scenario",
    title: "Offset scenario",
    description: "Target the specific macro or event outcome that hurts you most.",
  },
];

const PROTECTION_LEVELS: {
  id: HedgeProtectionLevel;
  title: string;
  description: string;
}[] = [
  {
    id: "partial",
    title: "Partial hedge",
    description: "Lower spend, more basis risk, more upside retained.",
  },
  {
    id: "full",
    title: "Full hedge",
    description: "Higher spend, tighter overlay, smaller residual downside.",
  },
];

const INTAKE_OPTIONS: {
  id: IntakeKind;
  title: string;
  description: string;
  placeholder: string;
  example: string;
}[] = [
  {
    id: "prediction_market",
    title: "Prediction market position",
    description: "Enter the event book you already own and the scenario you need to hedge.",
    placeholder: "Example: Trump wins 2028 on Polymarket",
    example: "Trump wins 2028 on Polymarket",
  },
  {
    id: "external_risk",
    title: "External / business risk",
    description: "Map real-world risk into a prediction market overlay.",
    placeholder: "Example: Auto importer exposed to US tariffs on Chinese goods",
    example: "Auto importer exposed to US tariffs on Chinese goods",
  },
  {
    id: "crypto_macro",
    title: "Crypto or macro book",
    description: "Describe the book and the downside regime you care about.",
    placeholder: "Example: Long 10 ETH and worried about a growth scare",
    example: "Long 10 ETH and worried about a growth scare",
  },
];

const DEMO_EXPOSURE_PRESETS: {
  title: string;
  intakeKind: IntakeKind;
  exposure: string;
  concern: string;
  notional?: string;
}[] = [
  {
    title: "Killer demo: tariff shock",
    intakeKind: "external_risk",
    exposure: "US importer exposed to new tariffs on Chinese goods",
    concern: "Margin compression if tariffs rise quickly",
    notional: "250000",
  },
  {
    title: "Fed stays higher",
    intakeKind: "external_risk",
    exposure: "Growth portfolio exposed to Fed staying higher for longer",
    concern: "Rates stay restrictive and growth reprices lower",
    notional: "300000",
  },
  {
    title: "Bitcoin drawdown",
    intakeKind: "crypto_macro",
    exposure: "Long BTC treasury with exposure to a sharp crypto drawdown",
    concern: "Risk-off move hits crypto and correlated growth trades",
    notional: "180000",
  },
  {
    title: "Election regulation",
    intakeKind: "external_risk",
    exposure: "Policy-sensitive business exposed to election-driven regulatory change",
    concern: "Election outcome shifts sector regulation and valuation",
    notional: "150000",
  },
];

const WORKSTATION_STEPS = [
  "1. Intake",
  "2. Objective",
  "3. Hedge sleeve",
  "4. Review",
];

const ANALYSIS_STAGES = [
  "Parsing mandate...",
  "Searching prediction markets...",
  "Constructing hedge sleeve...",
  "Running skeptic review...",
];

const MIN_ANALYSIS_MS = 1600;

function HedgePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") || "";
  const notionalParam = searchParams.get("n") || "";
  const concernParam = searchParams.get("c") || "";
  const qtyParam = searchParams.get("qty") || "";
  const avgParam = searchParams.get("avg") || "";
  const sourceParam = searchParams.get("src") || "";
  const scopeParam = searchParams.get("scope") || "";
  const sourceLabelParam = searchParams.get("sourceLabel") || "";
  const positionSnapshotParam = searchParams.get("positionSnapshot") || "";
  const sideParam = (searchParams.get("pside") as PositionSide | null) ?? "YES";
  const typeParam =
    (searchParams.get("t") as IntakeKind | null) ?? "external_risk";

  const [data, setData] = useState<HedgeDiscoveryResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [objective, setObjective] = useState<HedgeObjective>("protect_downside");
  const [protectionLevel, setProtectionLevel] =
    useState<HedgeProtectionLevel>("partial");
  const [reviewMode, setReviewMode] = useState<ReviewMode>("analysis");
  const [showDeskAnalysis, setShowDeskAnalysis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysisStageIndex, setAnalysisStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const [intakeKind, setIntakeKind] = useState<IntakeKind>(typeParam);
  const [exposureText, setExposureText] = useState(query);
  const [notionalUsd, setNotionalUsd] = useState(notionalParam);
  const [concern, setConcern] = useState(concernParam);
  const [positionQuantity, setPositionQuantity] = useState(qtyParam);
  const [averagePrice, setAveragePrice] = useState(avgParam);
  const [positionSide, setPositionSide] = useState<PositionSide>(sideParam);

  useEffect(() => {
    setIntakeKind(typeParam);
    setExposureText(query);
    setNotionalUsd(notionalParam);
    setConcern(concernParam);
    setPositionQuantity(qtyParam);
    setAveragePrice(avgParam);
    setPositionSide(sideParam);
  }, [avgParam, concernParam, notionalParam, qtyParam, query, sideParam, typeParam]);

  useEffect(() => {
    if (!query) {
      setData(null);
      setLoading(false);
      setError(null);
      setMessage(null);
      return;
    }

    async function fetchRecommendations() {
      const startedAt = Date.now();
      setLoading(true);
      setData(null);
      setError(null);
      setMessage(null);
      setAnalysisStageIndex(0);

      try {
        const res = await fetch("/api/hedge/recommend", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${AUTH_TOKEN}`,
          },
          body: JSON.stringify({ description: query }),
        });

        const json = await res.json();

        if (!res.ok) {
          setError(json.error || "Failed to fetch recommendations");
          setData(null);
          return;
        }

        const result: HedgeDiscoveryResult = json.data;
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_ANALYSIS_MS) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_ANALYSIS_MS - elapsed)
          );
        }
        setData(result);
        setObjective(result.defaultObjective);
        const firstRec =
          result.groups[0]?.recommendations[0] ?? result.recommendations[0];
        setSelected(firstRec ? new Set([firstRec.marketId]) : new Set());
        setMessage(json.message ?? null);
      } catch {
        setError("Network error. Please try again.");
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, [query]);

  useEffect(() => {
    setShowDeskAnalysis(false);
  }, [query]);

  useEffect(() => {
    if (!loading) {
      setAnalysisStageIndex(0);
      return;
    }

    const interval = window.setInterval(() => {
      setAnalysisStageIndex((current) =>
        Math.min(current + 1, ANALYSIS_STAGES.length - 1)
      );
    }, 420);

    return () => window.clearInterval(interval);
  }, [loading]);

  const quantityNum = Number(positionQuantity);
  const averagePriceNum = Number(averagePrice);
  const explicitNotional =
    Number(notionalUsd) > 0 ? Number(notionalUsd) : null;
  const premiumAtRisk =
    intakeKind === "prediction_market" &&
    quantityNum > 0 &&
    averagePriceNum > 0
      ? quantityNum * averagePriceNum
      : null;
  const maxPayout =
    intakeKind === "prediction_market" &&
    quantityNum > 0 &&
    averagePriceNum >= 0 &&
    averagePriceNum <= 1
      ? quantityNum * (1 - averagePriceNum)
      : null;
  const effectiveNotional = explicitNotional ?? premiumAtRisk;

  function buildMandate() {
    const concernLine = concern.trim()
      ? `Primary adverse scenario: ${concern.trim()}.`
      : "";
    const notionalLine = effectiveNotional
      ? `Estimated capital at risk: $${effectiveNotional.toFixed(2)}.`
      : "";

    switch (intakeKind) {
      case "prediction_market":
        return `Prediction market position: ${positionSide} ${positionQuantity || "?"} contracts in ${exposureText.trim()} at average price ${averagePrice || "?"}. ${concernLine} ${notionalLine} Build the hedge overlay entirely with prediction market contracts.`.trim();
      case "crypto_macro":
        return `Crypto or macro exposure: ${exposureText.trim()}. ${concernLine} ${notionalLine} Build the hedge overlay entirely with prediction market contracts.`.trim();
      default:
        return `External risk mandate: ${exposureText.trim()}. ${concernLine} ${notionalLine} Build the hedge overlay entirely with prediction market contracts.`.trim();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exposureText.trim()) return;

    const params = new URLSearchParams({
      q: buildMandate(),
      t: intakeKind,
    });

    if (concern.trim()) params.set("c", concern.trim());
    if (effectiveNotional) params.set("n", effectiveNotional.toFixed(2));

    if (intakeKind === "prediction_market") {
      if (positionQuantity.trim()) params.set("qty", positionQuantity.trim());
      if (averagePrice.trim()) params.set("avg", averagePrice.trim());
      params.set("pside", positionSide);
    }

    router.push(`/hedge?${params.toString()}`);
  }

  function applyExample(option: (typeof INTAKE_OPTIONS)[number]) {
    setIntakeKind(option.id);
    setExposureText(option.example);
  }

  function applyPreset(
    preset: (typeof DEMO_EXPOSURE_PRESETS)[number]
  ) {
    setIntakeKind(preset.intakeKind);
    setExposureText(preset.exposure);
    setConcern(preset.concern);
    setNotionalUsd(preset.notional ?? "");
    setPositionQuantity("");
    setAveragePrice("");
    setPositionSide("YES");
  }

  function toggleSelection(marketId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(marketId)) next.delete(marketId);
      else next.add(marketId);
      return next;
    });
  }

  function getExecutionSize(baseSize: number, coverageEstimate: number) {
    const objectiveMultiplier: Record<HedgeObjective, number> = {
      protect_downside: 1,
      reduce_volatility: 0.7,
      offset_scenario: 1.15,
    };
    const protectionMultiplier = protectionLevel === "full" ? 1.45 : 1;

    const contractsFromExposure = effectiveNotional
      ? Math.max(
          baseSize,
          Math.round((effectiveNotional * coverageEstimate) / 1000)
        )
      : baseSize;

    return Math.max(
      1,
      Math.round(
        contractsFromExposure *
          objectiveMultiplier[objective] *
          protectionMultiplier
      )
    );
  }

  const recommendations = data?.recommendations ?? [];
  const selectedRecs = recommendations.filter((r) => selected.has(r.marketId));
  const activeRecs =
    selectedRecs.length > 0
      ? selectedRecs
      : recommendations.slice(0, Math.min(2, recommendations.length));
  const totalEstimatedCost = selectedRecs.reduce(
    (sum, rec) =>
      sum + getExecutionSize(rec.suggestedSize, rec.coverageEstimate) * rec.currentPrice,
    0
  );
  const estimatedProtection = selectedRecs.reduce(
    (sum, rec) =>
      sum +
      getExecutionSize(rec.suggestedSize, rec.coverageEstimate) *
        rec.coverageEstimate,
    0
  );
  const baselineDownside = effectiveNotional ?? estimatedProtection * 2;
  const residualDownside = Math.max(
    baselineDownside - estimatedProtection,
    0
  );
  const estimatedReductionPct =
    baselineDownside > 0 ? estimatedProtection / baselineDownside : 0;
  const aggregateCoverage =
    selectedRecs.length > 0
      ? selectedRecs.reduce((sum, rec) => sum + rec.coverageEstimate, 0) /
        selectedRecs.length
      : 0;
  const hedgeRatio =
    baselineDownside > 0 ? estimatedProtection / baselineDownside : 0;
  const residualBasisRisk = Math.max(1 - aggregateCoverage, 0);
  const concentrationBucket =
    intakeKind === "prediction_market"
      ? "Single-event concentration"
      : data?.groups[0]?.title ?? "Mandate-level concentration";
  const realLegCount = activeRecs.filter((rec) =>
    ["polymarket", "kalshi"].includes(rec.platform)
  ).length;
  const simulatedLegCount = activeRecs.length - realLegCount;
  const reviewFlags = [
    data?.fallbackUsed
      ? "Fallback mode is active, so contract matching is using the seeded path instead of the full AI pipeline."
      : null,
    simulatedLegCount > 0
      ? `${simulatedLegCount} selected leg${simulatedLegCount === 1 ? "" : "s"} would still run in simulated mode.`
      : null,
    activeRecs.some((rec) => rec.confidenceLevel === "speculative")
      ? "At least one hedge candidate is labeled speculative and should be treated as an analyst suggestion, not a direct hedge."
      : null,
    data && data.platformsUnavailable.length > 0
      ? `Some venues were unavailable during analysis: ${data.platformsUnavailable.join(", ")}.`
      : null,
  ].filter(Boolean) as string[];
  const committeeTone =
    data?.committee.decision.confidence === "high"
      ? "border-[#BBF7D0]/60 bg-[#F0FDF4] text-[#166534]"
      : data?.committee.decision.confidence === "medium"
        ? "border-[#FDE68A]/60 bg-[#FFFBEB] text-[#92400E]"
        : "border-[#FECACA]/60 bg-[#FEF2F2] text-[#991B1B]";

  const mockLegs: SagaLeg[] = selectedRecs.map((r) => ({
    id: r.marketId,
    sagaId: "",
    platform: r.platform,
    marketId: r.marketId,
    marketTitle: r.title,
    side: r.side,
    size: getExecutionSize(r.suggestedSize, r.coverageEstimate),
    price: r.currentPrice,
    fillPrice: null,
    status: "PENDING",
    simulated: !["polymarket", "kalshi"].includes(r.platform),
    createdAt: "",
    updatedAt: "",
  }));
  const payoff: PayoffTableType = computePayoffTable(mockLegs);

  function exportHedgeTicket() {
    const lines = [
      "HedgeKit Hedge Ticket",
      "",
      `Mandate: ${query || "N/A"}`,
      `Objective: ${OBJECTIVES.find((item) => item.id === objective)?.title ?? objective}`,
      `Protection level: ${protectionLevel}`,
      effectiveNotional ? `Capital at risk: $${effectiveNotional.toFixed(2)}` : "Capital at risk: not provided",
      `Estimated spend: $${totalEstimatedCost.toFixed(2)}`,
      `Estimated hedge ratio: ${(hedgeRatio * 100).toFixed(0)}%`,
      `Residual basis risk: ${(residualBasisRisk * 100).toFixed(0)}%`,
      "",
      "Selected hedge sleeve:",
      ...selectedRecs.map(
        (rec) =>
          `- ${rec.platform} | ${rec.title} | ${rec.side} ${getExecutionSize(
            rec.suggestedSize,
            rec.coverageEstimate
          )} @ $${rec.currentPrice.toFixed(2)}`
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hedge-ticket.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExecute() {
    if (selectedRecs.length === 0) return;

    setExecuting(true);
    try {
      const legs = selectedRecs.map((r) => ({
        platform: r.platform,
        marketId: r.marketId,
        marketTitle: r.title,
        side: r.side,
        size: getExecutionSize(r.suggestedSize, r.coverageEstimate),
        price: r.currentPrice,
      }));

      const res = await fetch("/api/hedge/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        body: JSON.stringify({ legs }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to execute hedge");
        setExecuting(false);
        return;
      }

      if (sourceParam === "portfolio") {
        let parsedPositions: {
          id: string;
          title: string;
          platform: string;
          side: "YES" | "NO";
          quantity: number;
        }[] = [];

        try {
          parsedPositions = positionSnapshotParam
            ? JSON.parse(positionSnapshotParam)
            : [];
        } catch {
          parsedPositions = [];
        }

        addPortfolioHedge({
          id: json.data.sagaId,
          createdAt: new Date().toISOString(),
          sourceScope:
            scopeParam === "selected_positions" ? "selected_positions" : "portfolio",
          sourceLabel:
            sourceLabelParam ||
            (scopeParam === "selected_positions"
              ? `${parsedPositions.length} selected positions`
              : "Linked portfolio"),
          objective: OBJECTIVES.find((item) => item.id === objective)?.title ?? objective,
          protectionLevel,
          mandate: query,
          positions: parsedPositions.map((position) => ({
            id: position.id,
            title: position.title,
            platform: position.platform as SagaLeg["platform"],
            side: position.side,
            quantity: position.quantity,
          })),
          estimatedSpend: totalEstimatedCost,
          hedgeRatio,
          residualBasisRisk,
          status: "active",
          legs,
        });
      }

      router.push(`/execute/${json.data.sagaId}`);
    } catch {
      setError("Network error during execution.");
      setExecuting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-8">
      <div className="mb-6">
        <Link
          href="/"
          className="text-[12px] text-[#6366F1] transition-colors hover:text-[#4F46E5]"
        >
          &larr; Back
        </Link>
        <h1 className="mt-2 text-[30px] font-bold tracking-[-0.025em] text-[#0F172A]">
          Hedge Workstation
        </h1>
        <p className="mt-1 max-w-[780px] text-[13px] text-[#64748B]">
          Every hedge overlay in this product is built with prediction market
          contracts. Use this page to define the mandate, analyze the sleeve,
          export a hedge ticket, and only then move into one-click execution.
        </p>
        {sourceParam === "portfolio" && (
          <div className="mt-3 inline-flex rounded-full border border-[#D6DAF0] bg-[#6366F1]/[0.04] px-3 py-1 text-[11px] font-semibold text-[#4F46E5]">
            Portfolio handoff: {sourceLabelParam || "linked account scope"}
          </div>
        )}
      </div>

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        {WORKSTATION_STEPS.map((step, index) => (
          <div
            key={step}
            className={`rounded-2xl border px-4 py-3 text-[12px] font-medium ${
              index === 0
                ? "border-[#6366F1]/20 bg-[#6366F1]/[0.04] text-[#4F46E5]"
                : "border-[#E2E8F0] bg-white text-[#64748B]"
            }`}
          >
            {step}
          </div>
        ))}
      </div>

      <section className="mb-8 rounded-[28px] border border-[#E2E8F0] bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_58%,rgba(99,102,241,0.06)_100%)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
              Mandate intake
            </p>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F172A]">
              Define the hedge brief
            </h2>
            <p className="mt-1 text-[12px] text-[#64748B]">
              Keep it tight. Mandate, downside, size, then run the committee.
            </p>
          </div>
          <div className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-[11px] font-semibold text-[#64748B]">
            {query ? "Ready to refine" : "Start here"}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            {INTAKE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setIntakeKind(option.id)}
                className={`rounded-2xl border p-3 text-left transition-all ${
                  intakeKind === option.id
                    ? "border-[#6366F1] bg-white shadow-[0_0_0_1px_rgba(99,102,241,0.12)]"
                    : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]"
                }`}
              >
                <p className="text-[13px] font-semibold text-[#0F172A]">
                  {option.title}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
                  {option.description}
                </p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
              <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                Position or risk description
              </label>
              <textarea
                value={exposureText}
                onChange={(e) => setExposureText(e.target.value)}
                placeholder={
                  INTAKE_OPTIONS.find((option) => option.id === intakeKind)
                    ?.placeholder
                }
                className="mt-2 min-h-[98px] w-full resize-none rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[14px] text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10"
                maxLength={1000}
              />
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                  Adverse scenario
                </label>
                <input
                  type="text"
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                  placeholder="What outcome are you trying to protect against?"
                  className="mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[14px] text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10"
                />
              </div>

              {intakeKind === "prediction_market" ? (
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                      Position blotter
                    </p>
                    <div className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">
                      1 line item
                    </div>
                  </div>

                  <div className="mt-3 overflow-hidden rounded-2xl border border-[#E2E8F0]">
                    <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr] border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                      <span>Side</span>
                      <span>Quantity</span>
                      <span>Avg Price</span>
                      <span>Premium At Risk</span>
                    </div>
                    <div className="grid grid-cols-[0.8fr_1fr_1fr_1fr] items-center gap-2 bg-white px-3 py-3">
                      <select
                        value={positionSide}
                        onChange={(e) =>
                          setPositionSide(e.target.value as PositionSide)
                        }
                        className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[13px] font-semibold text-[#0F172A] outline-none transition-all focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10"
                      >
                        <option value="YES">YES</option>
                        <option value="NO">NO</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={positionQuantity}
                        onChange={(e) => setPositionQuantity(e.target.value)}
                        placeholder="0"
                        className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10"
                      />
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={averagePrice}
                        onChange={(e) => setAveragePrice(e.target.value)}
                        placeholder="0.00"
                        className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[13px] text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10"
                      />
                      <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-[13px] font-semibold text-[#0F172A]">
                        {premiumAtRisk !== null
                          ? `$${premiumAtRisk.toFixed(2)}`
                          : "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <MiniMetric
                      label="Max Payout"
                      value={maxPayout !== null ? `$${maxPayout.toFixed(2)}` : "N/A"}
                    />
                    <MiniMetric
                      label="Capital At Risk"
                      value={
                        premiumAtRisk !== null
                          ? `$${premiumAtRisk.toFixed(2)}`
                          : "N/A"
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                  <label className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                    Estimated capital at risk
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={notionalUsd}
                    onChange={(e) => setNotionalUsd(e.target.value)}
                    placeholder="Optional, USD"
                    className="mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[14px] text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10"
                  />
                </div>
              )}

              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                      Quick start
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DEMO_EXPOSURE_PRESETS.map((preset) => (
                        <button
                          key={preset.title}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="rounded-lg border border-[#6366F1]/15 bg-[#6366F1]/[0.04] px-3 py-1.5 text-[11px] font-medium text-[#4F46E5] transition-all hover:border-[#6366F1]/35 hover:bg-white"
                        >
                          {preset.title}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={
                      !exposureText.trim() ||
                      (intakeKind === "prediction_market" &&
                        (!positionQuantity.trim() || !averagePrice.trim()))
                    }
                    className="rounded-xl bg-[#0F172A] px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Build Hedge Sleeve
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {INTAKE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => applyExample(option)}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-[11px] text-[#64748B] transition-all hover:border-[#6366F1]/30 hover:bg-[#6366F1]/[0.03] hover:text-[#6366F1]"
              >
                {option.title}: {option.example}
              </button>
            ))}
          </div>
        </form>
      </section>

      {!query && (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 text-center">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#0F172A]">
            No hedge mandate loaded yet
          </h2>
          <p className="mx-auto mt-2 max-w-[640px] text-[13px] leading-relaxed text-[#64748B]">
            Start from this workstation. Enter a prediction market position or
            external risk, and the platform will express the resulting overlay
            with prediction market contracts.
          </p>
        </div>
      )}

      {query && (
        <>
          {message && (
            <div className="mb-4 rounded-lg border border-[#F59E0B]/20 bg-[#F59E0B]/[0.05] px-3 py-2 text-[12px] text-[#D97706]">
              {message}
            </div>
          )}

          {loading && (
            <div className="py-20 text-center">
              <div className="mx-auto max-w-[520px] rounded-[28px] border border-[#E2E8F0] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
                <div className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#0F172A]">
                  <svg
                    className="h-4 w-4 animate-spin text-[#6366F1]"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {ANALYSIS_STAGES[analysisStageIndex]}
                </div>
                <div className="mt-5 grid gap-3 text-left">
                  {ANALYSIS_STAGES.map((stage, index) => {
                    const isComplete = index < analysisStageIndex;
                    const isActive = index === analysisStageIndex;

                    return (
                      <div
                        key={stage}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-[13px] transition-all ${
                          isActive
                            ? "border-[#6366F1]/30 bg-[#6366F1]/[0.05] text-[#0F172A]"
                            : isComplete
                              ? "border-[#DCFCE7] bg-[#F0FDF4] text-[#166534]"
                              : "border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"
                        }`}
                      >
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                            isActive
                              ? "bg-[#6366F1] text-white"
                              : isComplete
                                ? "bg-[#10B981] text-white"
                                : "bg-white text-[#94A3B8]"
                          }`}
                        >
                          {isComplete ? "✓" : index + 1}
                        </span>
                        <span>{stage}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/[0.05] p-4 text-[13px] text-[#DC2626]">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                        Workbench overview
                      </p>
                      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                        {data.exposureSummary.detectedExposure}
                      </h2>
                      <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[#64748B]">
                        {data.committee.decision.acceptanceReason}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold text-[#64748B]">
                        Prediction-market overlay
                      </div>
                      <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${committeeTone}`}>
                        {data.committee.decision.confidence} conviction
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowDeskAnalysis((prev) => !prev)}
                        className="rounded-full border border-[#D6DAF0] bg-white px-3 py-1 text-[11px] font-semibold text-[#4F46E5] transition-colors hover:bg-[#F8FAFC]"
                      >
                        {showDeskAnalysis ? "Hide desk analysis" : "Show desk analysis"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <MetricCard
                          label="Capital at risk"
                          value={
                            effectiveNotional
                              ? `$${effectiveNotional.toFixed(2)}`
                              : "Not provided"
                          }
                        />
                        <MetricCard
                          label="Adverse scenario"
                          value={data.exposureSummary.harmScenario}
                        />
                        <MetricCard
                          label="Recommended sleeve"
                          value={data.committee.decision.recommendedSleeve}
                        />
                        <MetricCard
                          label="Selected legs"
                          value={`${selected.size || activeRecs.length} in ticket`}
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                        Set the overlay
                      </p>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {OBJECTIVES.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setObjective(item.id)}
                            className={`rounded-2xl border p-3 text-left transition-all ${
                              objective === item.id
                                ? "border-[#6366F1] bg-[#6366F1]/[0.04] shadow-[0_0_0_1px_rgba(99,102,241,0.12)]"
                                : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]"
                            }`}
                          >
                            <p className="text-[13px] font-semibold text-[#0F172A]">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
                              {item.description}
                            </p>
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {PROTECTION_LEVELS.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setProtectionLevel(item.id)}
                            className={`rounded-2xl border p-3 text-left transition-all ${
                              protectionLevel === item.id
                                ? "border-[#10B981] bg-[#10B981]/[0.04] shadow-[0_0_0_1px_rgba(16,185,129,0.12)]"
                                : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1]"
                            }`}
                          >
                            <p className="text-[13px] font-semibold text-[#0F172A]">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">
                              {item.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {showDeskAnalysis && (
                  <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                          Desk analysis
                        </p>
                        <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                          Exposure and committee detail
                        </h2>
                      </div>
                      <div className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold text-[#64748B]">
                        Open only when you need the memo
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                            Desk view
                          </p>
                          <p className="mt-2 text-[16px] font-semibold text-[#0F172A]">
                            {data.exposureSummary.title}
                          </p>
                          <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                            {data.exposureSummary.summary}
                          </p>
                          <p className="mt-3 text-[12px] leading-relaxed text-[#475569]">
                            {data.exposureSummary.deskView}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                            Chair summary
                          </p>
                          <p className="mt-2 text-[13px] leading-relaxed text-[#0F172A]">
                            {data.committee.decision.acceptanceReason}
                          </p>
                        </div>

                        {data.committee.decision.dissentingView && (
                          <div className="rounded-2xl border border-[#FECACA]/50 bg-[#FEF2F2] p-4">
                            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#991B1B]">
                              Dissenting view
                            </p>
                            <p className="mt-2 text-[12px] leading-relaxed text-[#991B1B]">
                              {data.committee.decision.dissentingView}
                            </p>
                          </div>
                        )}

                        {reviewFlags.length > 0 && (
                          <div className="rounded-2xl border border-[#FDE68A]/50 bg-[#FFFBEB] p-4">
                            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#B45309]">
                              Review flags
                            </p>
                            <div className="mt-2 space-y-2">
                              {reviewFlags.map((risk) => (
                                <p
                                  key={risk}
                                  className="text-[12px] leading-relaxed text-[#92400E]"
                                >
                                  {risk}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                            Committee roles
                          </p>
                          <div className="mt-3 space-y-3">
                            {data.committee.members.map((member) => (
                              <div
                                key={member.role}
                                className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[13px] font-semibold text-[#0F172A]">
                                    {member.title}
                                  </p>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] ${
                                      member.verdict === "support"
                                        ? "bg-[#10B981]/10 text-[#059669]"
                                        : "bg-[#F59E0B]/10 text-[#B45309]"
                                    }`}
                                  >
                                    {member.verdict}
                                  </span>
                                </div>
                                <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">
                                  {member.summary}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {intakeKind === "prediction_market" &&
                          premiumAtRisk !== null &&
                          maxPayout !== null && (
                          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                              Position math
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <MetricCard label="Position side" value={positionSide} />
                              <MetricCard
                                label="Premium at risk"
                                value={`$${premiumAtRisk.toFixed(2)}`}
                              />
                              <MetricCard
                                label="Max payout"
                                value={`$${maxPayout.toFixed(2)}`}
                              />
                              <MetricCard
                                label="Average price"
                                value={averagePriceNum.toFixed(2)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                )}

                <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                        Hedge sleeves
                      </p>
                      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                        Build the sleeve
                      </h2>
                    </div>
                    <div className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold text-[#64748B]">
                      {selected.size} selected
                    </div>
                  </div>

                  {data.groups.length === 0 && (
                    <div className="rounded-2xl border border-[#F59E0B]/20 bg-[#FFFBEB] p-5">
                      <h3 className="text-[18px] font-semibold text-[#92400E]">
                        No strong match yet
                      </h3>
                      <p className="mt-2 text-[13px] leading-relaxed text-[#92400E]">
                        We parsed the mandate, but did not find a clean hedge
                        sleeve with enough confidence. Tighten the event framing,
                        add the adverse scenario, or provide better position math
                        above.
                      </p>
                    </div>
                  )}

                  <div className="space-y-6">
                    {data.groups.map((group) => (
                      <div key={group.id}>
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <div>
                            <h3 className="text-[16px] font-semibold text-[#0F172A]">
                              {group.title}
                            </h3>
                            <p className="text-[12px] text-[#64748B]">
                              {group.description}
                            </p>
                          </div>
                          <div className="rounded-full border border-[#E2E8F0] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#94A3B8]">
                            {group.recommendations.length} ideas
                          </div>
                        </div>

                        <div className="space-y-3">
                          {group.recommendations.map((rec) => (
                            <HedgeCard
                              key={rec.marketId}
                              recommendation={rec}
                              selected={selected.has(rec.marketId)}
                              onToggle={() => toggleSelection(rec.marketId)}
                              objective={objective}
                              protectionLevel={protectionLevel}
                              executionSize={getExecutionSize(
                                rec.suggestedSize,
                                rec.coverageEstimate
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
                <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                        Review
                      </p>
                      <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                        Hedge ticket
                      </h2>
                    </div>
                    <div className="flex rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1">
                      <button
                        onClick={() => setReviewMode("analysis")}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                          reviewMode === "analysis"
                            ? "bg-white text-[#0F172A] shadow-sm"
                            : "text-[#64748B]"
                        }`}
                      >
                        Analysis
                      </button>
                      <button
                        onClick={() => setReviewMode("execution")}
                        className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                          reviewMode === "execution"
                            ? "bg-white text-[#0F172A] shadow-sm"
                            : "text-[#64748B]"
                        }`}
                      >
                        Execution
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                        Overlay mandate
                      </p>
                        <p className="mt-1 text-[13px] font-semibold text-[#0F172A]">
                          {OBJECTIVES.find((item) => item.id === objective)?.title}
                        </p>
                        <p className="mt-1 text-[12px] text-[#64748B] capitalize">
                          {protectionLevel} hedge
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <MetricCard
                        label="Capital at risk"
                        value={
                          effectiveNotional
                            ? `$${effectiveNotional.toFixed(2)}`
                            : "Not provided"
                        }
                      />
                      <MetricCard
                        label="Estimated spend"
                        value={`$${totalEstimatedCost.toFixed(2)}`}
                      />
                      <MetricCard
                        label="Hedge ratio"
                        value={`${(hedgeRatio * 100).toFixed(0)}%`}
                      />
                      <MetricCard
                        label="Residual basis risk"
                        value={`${(residualBasisRisk * 100).toFixed(0)}%`}
                      />
                    </div>

                    <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-[#64748B]">Before downside</span>
                        <span className="font-semibold text-[#0F172A]">
                          ${baselineDownside.toFixed(0)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[12px]">
                        <span className="text-[#64748B]">After downside</span>
                        <span className="font-semibold text-[#0F172A]">
                          ${residualDownside.toFixed(0)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[12px]">
                        <span className="text-[#64748B]">Concentration bucket</span>
                        <span className="font-semibold text-[#0F172A]">
                          {concentrationBucket}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[12px]">
                        <span className="text-[#64748B]">Estimated reduction</span>
                        <span className="font-semibold text-[#059669]">
                          {(estimatedReductionPct * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedRecs.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {selectedRecs.map((rec) => (
                        <div
                          key={rec.marketId}
                          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                        >
                          <p className="text-[12px] font-semibold text-[#0F172A]">
                            {rec.title}
                          </p>
                          <p className="mt-1 text-[11px] text-[#64748B]">
                            {rec.side}{" "}
                            {getExecutionSize(
                              rec.suggestedSize,
                              rec.coverageEstimate
                            )}{" "}
                            @ ${rec.currentPrice.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {reviewMode === "analysis" ? (
                    <button
                      onClick={exportHedgeTicket}
                      disabled={selectedRecs.length === 0}
                      className="mt-5 w-full rounded-xl border border-[#0F172A] bg-white py-3 text-[13px] font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Export Hedge Ticket
                    </button>
                  ) : (
                    <button
                      onClick={handleExecute}
                      disabled={executing || selectedRecs.length === 0}
                      className="mt-5 w-full rounded-xl bg-[#0F172A] py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {executing ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg
                            className="h-3.5 w-3.5 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Launching hedge...
                        </span>
                      ) : (
                        `Send One-Click Hedge${
                          selectedRecs.length > 0 ? ` (${selectedRecs.length})` : ""
                        }`
                      )}
                    </button>
                  )}
                </div>

                <PayoffChart payoff={payoff} />
                <PayoffTable payoff={payoff} />
              </aside>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[#0F172A]">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[#0F172A]">{value}</p>
    </div>
  );
}

export default function HedgePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[640px] px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 text-[14px] text-[#94A3B8]">
            <svg
              className="h-4 w-4 animate-spin text-[#6366F1]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Loading...
          </div>
        </div>
      }
    >
      <HedgePageInner />
    </Suspense>
  );
}
