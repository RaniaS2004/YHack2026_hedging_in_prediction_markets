"use client";

import { ArbFilterState, ArbType, Platform, REAL_PLATFORMS, SIMULATED_PLATFORMS } from "@/types";

interface ArbFiltersProps {
  filters: ArbFilterState;
  onChange: (filters: ArbFilterState) => void;
  categories: string[];
  totalCount: number;
  filteredCount: number;
}

const ALL_PLATFORMS: Platform[] = [...REAL_PLATFORMS, ...SIMULATED_PLATFORMS];

export default function ArbFilters({
  filters,
  onChange,
  categories,
  totalCount,
  filteredCount,
}: ArbFiltersProps) {
  function update(partial: Partial<ArbFilterState>) {
    onChange({ ...filters, ...partial });
  }

  function togglePlatform(p: Platform) {
    const current = filters.platforms;
    if (current.includes(p)) {
      // Don't allow removing all platforms
      if (current.length <= 1) return;
      update({ platforms: current.filter((x) => x !== p) });
    } else {
      update({ platforms: [...current, p] });
    }
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Platform filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">
            Platforms
          </span>
          <div className="flex gap-1">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p}
                onClick={() => togglePlatform(p)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-all duration-100 ${
                  filters.platforms.includes(p)
                    ? "bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20"
                    : "bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0] hover:border-[#CBD5E1]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-[#E2E8F0]" />

        {/* Min profit */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">
            Min Profit
          </span>
          <select
            value={filters.minProfit}
            onChange={(e) => update({ minProfit: parseFloat(e.target.value) })}
            className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[12px] text-[#0F172A] focus:outline-none focus:border-[#6366F1]"
          >
            <option value={0}>Any</option>
            <option value={1}>1%+</option>
            <option value={2}>2%+</option>
            <option value={5}>5%+</option>
            <option value={10}>10%+</option>
          </select>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-[#E2E8F0]" />

        {/* Arb type */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">
            Type
          </span>
          <div className="flex gap-1">
            {(["ALL", "PRICE_DIVERGENCE", "COMPLEMENTARY"] as const).map(
              (t) => (
                <button
                  key={t}
                  onClick={() => update({ arbType: t })}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-100 ${
                    filters.arbType === t
                      ? "bg-[#6366F1]/10 text-[#6366F1] border border-[#6366F1]/20"
                      : "bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0] hover:border-[#CBD5E1]"
                  }`}
                >
                  {t === "ALL"
                    ? "All"
                    : t === "PRICE_DIVERGENCE"
                      ? "Price Div."
                      : "Complementary"}
                </button>
              )
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-[#E2E8F0]" />

        {/* Category */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">
              Category
            </span>
            <select
              value={filters.category}
              onChange={(e) => update({ category: e.target.value })}
              className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[12px] text-[#0F172A] capitalize focus:outline-none focus:border-[#6366F1]"
            >
              <option value="all">All</option>
              {categories.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Separator */}
        <div className="w-px h-6 bg-[#E2E8F0]" />

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-[#94A3B8] uppercase tracking-wider">
            Sort
          </span>
          <select
            value={filters.sortBy}
            onChange={(e) =>
              update({
                sortBy: e.target.value as ArbFilterState["sortBy"],
              })
            }
            className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[12px] text-[#0F172A] focus:outline-none focus:border-[#6366F1]"
          >
            <option value="profit">Profit %</option>
            <option value="volume">Volume</option>
            <option value="spread">Spread</option>
            <option value="detected">Newest</option>
          </select>
        </div>

        {/* Result count */}
        <div className="ml-auto">
          <span className="text-[11px] text-[#94A3B8]">
            Showing{" "}
            <span className="font-semibold text-[#0F172A]">{filteredCount}</span>{" "}
            of {totalCount}
          </span>
        </div>
      </div>
    </div>
  );
}
