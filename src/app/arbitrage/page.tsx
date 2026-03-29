"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArbOpportunity,
  MarketMatch,
  SpreadRow,
  ArbFilterState,
  Platform,
  REAL_PLATFORMS,
  SIMULATED_PLATFORMS,
} from "@/types";
import ArbCard from "@/components/ArbCard";
import ArbFilters from "@/components/ArbFilters";
import SpreadTable from "@/components/SpreadTable";
import RelationshipBadge from "@/components/RelationshipBadge";
import CorrelationHeatmap from "@/components/CorrelationHeatmap";

const AUTH_TOKEN = "hedgehog-dev-token";
const POLL_INTERVAL = 5000; // 5 seconds

interface ArbScanResult {
  opportunities: ArbOpportunity[];
  matches: MarketMatch[];
  spreadTable: SpreadRow[];
  categories: string[];
  stats: {
    marketsScanned: number;
    matchesFound: number;
    arbOpportunities: number;
    sameEventMatches: number;
  };
  lastUpdated: string;
}

const DEFAULT_FILTERS: ArbFilterState = {
  platforms: [...REAL_PLATFORMS, ...SIMULATED_PLATFORMS],
  minProfit: 0,
  arbType: "ALL",
  category: "all",
  sortBy: "profit",
};

export default function ArbitragePage() {
  const [data, setData] = useState<ArbScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showMatches, setShowMatches] = useState(false);
  const [filters, setFilters] = useState<ArbFilterState>(DEFAULT_FILTERS);
  const [polling, setPolling] = useState(true);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [activeTab, setActiveTab] = useState<"opportunities" | "spreads">(
    "opportunities"
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  // Fetch data (initial or refresh)
  const fetchData = useCallback(
    async (isRefresh = false) => {
      try {
        const url = isRefresh
          ? "/api/arbitrage/scan?refresh=true"
          : "/api/arbitrage/scan";
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json = await res.json();
        setData(json.data);
        setLastPoll(new Date());
        setError(null);
      } catch (err) {
        if (!isRefresh) {
          setError(err instanceof Error ? err.message : "Failed to scan");
        }
      } finally {
        if (!isRefresh) setLoading(false);
      }
    },
    []
  );

  // Initial fetch
  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Polling
  useEffect(() => {
    if (!polling || loading) return;

    pollRef.current = setInterval(() => {
      fetchData(true);
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [polling, loading, fetchData]);

  // Seconds-ago counter
  useEffect(() => {
    const timer = setInterval(() => {
      if (lastPoll) {
        setSecondsAgo(Math.floor((Date.now() - lastPoll.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastPoll]);

  // Apply filters to opportunities
  const filteredOpportunities = data
    ? data.opportunities
        .filter((arb) => {
          // Platform filter
          if (
            !filters.platforms.includes(arb.buyPlatform) &&
            !filters.platforms.includes(arb.sellPlatform)
          )
            return false;

          // Min profit
          if (arb.profitMargin * 100 < filters.minProfit) return false;

          // Arb type
          if (filters.arbType !== "ALL" && arb.arbType !== filters.arbType)
            return false;

          // Category filter
          if (filters.category !== "all") {
            const title = (
              arb.buyMarketTitle +
              " " +
              arb.sellMarketTitle
            ).toLowerCase();
            const matchesCategory = categoryMatches(title, filters.category);
            if (!matchesCategory) return false;
          }

          return true;
        })
        .sort((a, b) => {
          switch (filters.sortBy) {
            case "profit":
              return b.profitMargin - a.profitMargin;
            case "spread":
              return Math.abs(b.sellPrice - b.buyPrice) - Math.abs(a.sellPrice - a.buyPrice);
            case "detected":
              return (
                new Date(b.detectedAt).getTime() -
                new Date(a.detectedAt).getTime()
              );
            case "volume":
            default:
              return b.profitMargin - a.profitMargin;
          }
        })
    : [];

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleExecute() {
    if (!data) return;
    const arbs = data.opportunities.filter((a) => selected.has(a.id));
    if (arbs.length === 0) return;

    const legs = arbs.flatMap((arb) => [
      {
        platform: arb.buyPlatform,
        marketId: arb.buyMarketId,
        marketTitle: arb.buyMarketTitle,
        side: arb.buySide,
        size: 10,
        price: arb.buyPrice,
      },
      {
        platform: arb.sellPlatform,
        marketId: arb.sellMarketId,
        marketTitle: arb.sellMarketTitle,
        side: arb.sellSide,
        size: 10,
        price: arb.sellPrice,
      },
    ]);

    try {
      const res = await fetch("/api/hedge/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        body: JSON.stringify({ legs: legs.slice(0, 4) }),
      });
      const json = await res.json();
      if (json.data?.sagaId) {
        router.push(`/execute/${json.data.sagaId}`);
      }
    } catch (err) {
      console.error("Execute error:", err);
    }
  }

  return (
    <div className="mx-auto max-w-[1120px] px-6 pt-10 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] tracking-[-0.02em]">
            Arbitrage Scanner
          </h1>
          <p className="text-[14px] text-[#64748B] mt-1">
            Real-time cross-platform price discrepancies detected by AI
          </p>
        </div>
        <div className="flex items-center gap-5">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPolling(!polling)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all ${
                polling
                  ? "border-[#22C55E]/30 bg-[#22C55E]/[0.05] text-[#22C55E]"
                  : "border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  polling ? "bg-[#22C55E] animate-pulse" : "bg-[#E2E8F0]"
                }`}
              />
              {polling ? "LIVE" : "Paused"}
            </button>
            {lastPoll && (
              <span className="text-[11px] text-[#94A3B8] font-mono">
                {secondsAgo}s ago
              </span>
            )}
          </div>

          {/* Stats */}
          {data && (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider">
                  Markets
                </p>
                <p className="text-[18px] font-bold font-mono text-[#0F172A]">
                  {data.stats.marketsScanned.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider">
                  Same Events
                </p>
                <p className="text-[18px] font-bold font-mono text-[#6366F1]">
                  {data.stats.sameEventMatches}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#94A3B8] uppercase tracking-wider">
                  Arb Opps
                </p>
                <p className="text-[18px] font-bold font-mono text-[#22C55E]">
                  {data.stats.arbOpportunities}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <svg
            className="animate-spin h-8 w-8 text-[#6366F1] mb-4"
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
          <p className="text-[14px] text-[#64748B]">
            Scanning 5 platforms for arbitrage...
          </p>
          <p className="text-[12px] text-[#94A3B8] mt-1">
            Fetching live orderbook data from Polymarket CLOB + Kalshi
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/5 p-4 mb-6">
          <p className="text-[14px] text-[#EF4444]">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Tab switcher */}
          <div className="flex items-center gap-1 mb-4 border-b border-[#E2E8F0]">
            <button
              onClick={() => setActiveTab("opportunities")}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === "opportunities"
                  ? "text-[#6366F1] border-[#6366F1]"
                  : "text-[#94A3B8] border-transparent hover:text-[#64748B]"
              }`}
            >
              Opportunities ({data.opportunities.length})
            </button>
            <button
              onClick={() => setActiveTab("spreads")}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
                activeTab === "spreads"
                  ? "text-[#6366F1] border-[#6366F1]"
                  : "text-[#94A3B8] border-transparent hover:text-[#64748B]"
              }`}
            >
              Spread Table ({data.spreadTable.length})
            </button>
          </div>

          {/* Filters */}
          <div className="mb-4">
            <ArbFilters
              filters={filters}
              onChange={setFilters}
              categories={data.categories}
              totalCount={data.opportunities.length}
              filteredCount={filteredOpportunities.length}
            />
          </div>

          {/* Tab content */}
          {activeTab === "opportunities" && (
            <>
              {filteredOpportunities.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 mb-8">
                  {filteredOpportunities.map((arb) => (
                    <ArbCard
                      key={arb.id}
                      arb={arb}
                      selected={selected.has(arb.id)}
                      onToggle={() => toggleSelect(arb.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center mb-8">
                  <p className="text-[15px] text-[#64748B]">
                    {data.opportunities.length > 0
                      ? "No opportunities match your filters"
                      : "No arbitrage opportunities detected right now"}
                  </p>
                  <p className="text-[12px] text-[#94A3B8] mt-1">
                    {data.opportunities.length > 0
                      ? "Try relaxing your filter criteria"
                      : "Arb windows are ephemeral — polling every 5s for changes"}
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === "spreads" && (
            <div className="mb-8">
              {data.spreadTable.length > 0 ? (
                <SpreadTable rows={data.spreadTable} />
              ) : (
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
                  <p className="text-[15px] text-[#64748B]">
                    No cross-platform event matches found yet
                  </p>
                  <p className="text-[12px] text-[#94A3B8] mt-1">
                    The AI classifier is looking for the same events across
                    different platforms
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Execute button */}
          {selected.size > 0 && (
            <div className="sticky bottom-6 flex justify-center z-10">
              <button
                onClick={handleExecute}
                className="rounded-xl bg-[#6366F1] px-8 py-3.5 text-[14px] font-semibold text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)] hover:bg-[#4F46E5] transition-all duration-150"
              >
                Execute {selected.size} Arbitrage{" "}
                {selected.size === 1 ? "Trade" : "Trades"}
              </button>
            </div>
          )}

          {/* Market Relationships */}
          <div className="mt-6">
            <button
              onClick={() => setShowMatches(!showMatches)}
              className="flex items-center gap-2 text-[13px] font-medium text-[#64748B] hover:text-[#6366F1] transition-colors"
            >
              <svg
                className={`w-4 h-4 transition-transform ${
                  showMatches ? "rotate-90" : ""
                }`}
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
              {data.matches.length} Market Relationships Detected
            </button>

            {showMatches && (
              <div className="mt-4 space-y-2">
                {data.matches.slice(0, 20).map((match) => (
                  <div
                    key={match.id}
                    className="rounded-lg border border-[#E2E8F0] bg-white p-3 flex items-start gap-3"
                  >
                    <RelationshipBadge relationship={match.relationship} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#0F172A] truncate">
                        {match.marketATitle}
                      </p>
                      <p className="text-[11px] text-[#94A3B8]">
                        ↔ {match.marketBTitle}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-1 italic">
                        {match.reasoning}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-[#94A3B8]">
                      {(match.matchConfidence * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Correlation Heatmap */}
          {data.matches.length > 0 && (
            <div className="mt-8">
              <CorrelationHeatmap matches={data.matches} />
            </div>
          )}

          {/* Polling footer */}
          <div className="mt-8 flex items-center justify-center gap-3 py-3 border-t border-[#E2E8F0]">
            <span className="text-[11px] text-[#94A3B8] font-mono">
              Polling Polymarket CLOB + Kalshi every 5s
            </span>
            {polling && (
              <span className="flex items-center gap-1 text-[11px] text-[#22C55E]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                Live
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Simple category matcher for filtering */
function categoryMatches(title: string, category: string): boolean {
  const patterns: Record<string, RegExp> = {
    trade: /tariff|trade|import|export|sanction/,
    crypto: /bitcoin|btc|eth|crypto|sol|defi|token/,
    politics: /trump|biden|election|senate|congress|vote/,
    economics: /fed|rate|inflation|gdp|recession|cpi|employment/,
    tech: /ai|openai|google|apple|tech|chip|nvidia/,
    geopolitics: /war|conflict|nato|military|nuclear|china|russia/,
    climate: /climate|weather|hurricane|earthquake/,
    sports: /nfl|nba|mlb|nhl|soccer|football|game/,
  };
  return patterns[category]?.test(title) ?? false;
}
