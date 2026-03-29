"use client";

import { SpreadRow, Platform } from "@/types";
import PlatformBadge from "./PlatformBadge";

interface SpreadTableProps {
  rows: SpreadRow[];
}

const PLATFORM_ORDER: Platform[] = [
  "polymarket",
  "kalshi",
  "limitless",
  "myriad",
  "opinion",
];

function formatPrice(n: number): string {
  return (n * 100).toFixed(1) + "¢";
}

function formatSpread(n: number): string {
  if (n === 0) return "—";
  return (n * 100).toFixed(1) + "¢";
}

export default function SpreadTable({ rows }: SpreadTableProps) {
  if (rows.length === 0) return null;

  // Determine which platforms are actually present
  const activePlatforms = PLATFORM_ORDER.filter((p) =>
    rows.some((r) => r.platforms[p])
  );

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3.5 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-[#0F172A]">
            Cross-Platform Spread Comparison
          </h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            Same events priced across {activePlatforms.length} platforms — {rows.length} events tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span className="text-[10px] text-[#64748B]">Arb available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#E2E8F0]" />
            <span className="text-[10px] text-[#64748B]">No data</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#FAFBFC]">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider w-[280px] min-w-[280px]">
                Event
              </th>
              {activePlatforms.map((p) => (
                <th
                  key={p}
                  className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider min-w-[120px]"
                >
                  <div className="flex justify-center">
                    <PlatformBadge platform={p} />
                  </div>
                </th>
              ))}
              <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider min-w-[80px]">
                Max Diff
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={row.matchId}
                className={`border-b border-[#F1F5F9] transition-colors duration-100 hover:bg-[#FAFBFC] ${
                  row.arbAvailable ? "bg-[#22C55E]/[0.02]" : ""
                }`}
              >
                {/* Event name */}
                <td className="px-4 py-3">
                  <p className="text-[12px] font-medium text-[#0F172A] leading-tight line-clamp-2">
                    {row.eventName}
                  </p>
                  <span className="inline-block mt-1 rounded px-1.5 py-0.5 text-[9px] font-medium text-[#94A3B8] bg-[#F8FAFC] border border-[#E2E8F0] uppercase">
                    {row.category}
                  </span>
                </td>

                {/* Platform prices */}
                {activePlatforms.map((p) => {
                  const data = row.platforms[p];
                  if (!data) {
                    return (
                      <td key={p} className="px-3 py-3 text-center">
                        <span className="text-[#E2E8F0]">—</span>
                      </td>
                    );
                  }

                  // Find the min and max YES price across platforms for this row
                  const allPrices = Object.values(row.platforms).map(
                    (d) => d!.yesPrice
                  );
                  const minPrice = Math.min(...allPrices);
                  const maxPrice = Math.max(...allPrices);
                  const isLowest = data.yesPrice === minPrice && allPrices.length > 1;
                  const isHighest = data.yesPrice === maxPrice && allPrices.length > 1;

                  return (
                    <td key={p} className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`text-[13px] font-mono font-semibold ${
                            isLowest
                              ? "text-[#22C55E]"
                              : isHighest
                                ? "text-[#EF4444]"
                                : "text-[#0F172A]"
                          }`}
                        >
                          {formatPrice(data.yesPrice)}
                        </span>
                        {data.yesBid > 0 && (
                          <span className="text-[9px] text-[#94A3B8] font-mono">
                            {formatPrice(data.yesBid)}/{formatPrice(data.yesAsk)}
                          </span>
                        )}
                        <span className="text-[9px] text-[#CBD5E1] font-mono">
                          ${(data.volume24h / 1000).toFixed(0)}k vol
                        </span>
                      </div>
                    </td>
                  );
                })}

                {/* Max difference */}
                <td className="px-3 py-3 text-center">
                  <span
                    className={`text-[13px] font-mono font-bold ${
                      row.maxPriceDiff >= 0.05
                        ? "text-[#22C55E]"
                        : row.maxPriceDiff >= 0.02
                          ? "text-[#F59E0B]"
                          : "text-[#94A3B8]"
                    }`}
                  >
                    {(row.maxPriceDiff * 100).toFixed(1)}¢
                  </span>
                  {row.arbAvailable && (
                    <div className="mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length >= 15 && (
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-center">
          <span className="text-[11px] text-[#94A3B8]">
            Showing top 15 events by spread size
          </span>
        </div>
      )}
    </div>
  );
}
