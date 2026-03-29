"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Platform, UserPosition } from "@/types";
import PlatformBadge from "@/components/PlatformBadge";

const DEMO_POSITIONS: Record<Platform, UserPosition[]> = {
  polymarket: [
    {
      id: "pm-1",
      platform: "polymarket",
      marketId: "pm-trump-2028",
      marketTitle: "Will Trump run for office again in 2028?",
      side: "YES",
      quantity: 50,
      avgPrice: 0.35,
      currentPrice: 0.42,
    },
    {
      id: "pm-2",
      platform: "polymarket",
      marketId: "pm-fed-rate-cut",
      marketTitle: "Fed rate cut before July 2026?",
      side: "NO",
      quantity: 100,
      avgPrice: 0.55,
      currentPrice: 0.48,
    },
    {
      id: "pm-3",
      platform: "polymarket",
      marketId: "pm-btc-100k",
      marketTitle: "Bitcoin above $100k by end of 2026?",
      side: "YES",
      quantity: 30,
      avgPrice: 0.6,
      currentPrice: 0.67,
    },
  ],
  kalshi: [
    {
      id: "k-1",
      platform: "kalshi",
      marketId: "k-recession-2026",
      marketTitle: "US recession in 2026?",
      side: "YES",
      quantity: 75,
      avgPrice: 0.3,
      currentPrice: 0.38,
    },
    {
      id: "k-2",
      platform: "kalshi",
      marketId: "k-sp500-above-6000",
      marketTitle: "S&P 500 above 6000 at year end?",
      side: "YES",
      quantity: 40,
      avgPrice: 0.52,
      currentPrice: 0.45,
    },
  ],
  limitless: [],
  myriad: [],
  opinion: [],
};

type ConnectedPlatforms = Record<Platform, boolean>;

export default function PortfolioPage() {
  const router = useRouter();
  const [connected, setConnected] = useState<ConnectedPlatforms>({
    polymarket: false,
    kalshi: false,
    limitless: false,
    myriad: false,
    opinion: false,
  });
  const [connecting, setConnecting] = useState<Platform | null>(null);

  async function handleConnect(platform: Platform) {
    setConnecting(platform);
    // Simulated OAuth flow — 1.5s delay to mimic redirect
    await new Promise((r) => setTimeout(r, 1500));
    setConnected((prev) => ({ ...prev, [platform]: true }));
    setConnecting(null);
  }

  function handleDisconnect(platform: Platform) {
    setConnected((prev) => ({ ...prev, [platform]: false }));
  }

  const allPositions = Object.entries(connected)
    .filter(([, isConnected]) => isConnected)
    .flatMap(([platform]) => DEMO_POSITIONS[platform as Platform]);

  const totalValue = allPositions.reduce(
    (sum, p) => sum + p.quantity * (p.currentPrice ?? p.avgPrice),
    0
  );

  const totalCost = allPositions.reduce(
    (sum, p) => sum + p.quantity * p.avgPrice,
    0
  );

  const totalPnl = totalValue - totalCost;

  const platformBreakdown = Object.entries(connected)
    .filter(([, isConnected]) => isConnected)
    .map(([platform]) => {
      const positions = DEMO_POSITIONS[platform as Platform];
      const value = positions.reduce(
        (s, p) => s + p.quantity * (p.currentPrice ?? p.avgPrice),
        0
      );
      return { platform: platform as Platform, value, count: positions.length };
    })
    .filter((p) => p.count > 0);

  const categoryBreakdown = allPositions.reduce(
    (acc, p) => {
      const cat = p.marketTitle.includes("Bitcoin") || p.marketTitle.includes("crypto")
        ? "Crypto"
        : p.marketTitle.includes("recession") || p.marketTitle.includes("S&P") || p.marketTitle.includes("Fed")
        ? "Economy"
        : "Politics";
      acc[cat] = (acc[cat] || 0) + p.quantity * (p.currentPrice ?? p.avgPrice);
      return acc;
    },
    {} as Record<string, number>
  );

  function hedgeAll() {
    const desc = allPositions
      .map((p) => `${p.side} on "${p.marketTitle}" (${p.platform})`)
      .join(", ");
    const params = new URLSearchParams({
      q: `I hold these positions: ${desc}. Find hedges for my portfolio.`,
    });
    router.push(`/hedge?${params.toString()}`);
  }

  const OAUTH_PLATFORMS: { platform: Platform; name: string; color: string }[] = [
    { platform: "polymarket", name: "Polymarket", color: "#3B82F6" },
    { platform: "kalshi", name: "Kalshi", color: "#8B5CF6" },
    { platform: "limitless", name: "Limitless", color: "#22C55E" },
  ];

  return (
    <div className="mx-auto max-w-[1120px] px-6 pt-10 pb-16">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] tracking-[-0.02em]">
            Portfolio
          </h1>
          <p className="text-[14px] text-[#64748B] mt-1">
            Connect accounts. View unified risk. One-click hedge.
          </p>
        </div>
        {allPositions.length > 0 && (
          <button
            onClick={hedgeAll}
            className="rounded-xl bg-[#6366F1] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#4F46E5] transition-all duration-150 shadow-[0_1px_2px_rgba(99,102,241,0.3)]"
          >
            Hedge Entire Portfolio
          </button>
        )}
      </div>

      {/* Connect Accounts */}
      <div className="mb-8">
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3">
          Connected Accounts
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {OAUTH_PLATFORMS.map(({ platform, name, color }) => (
            <div
              key={platform}
              className={`rounded-xl border p-4 transition-all duration-150 ${
                connected[platform]
                  ? "border-[#22C55E]/30 bg-[#22C55E]/[0.02]"
                  : "border-[#E2E8F0] bg-white"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[12px] font-bold"
                    style={{ backgroundColor: color }}
                  >
                    {name[0]}
                  </div>
                  <span className="text-[14px] font-semibold text-[#0F172A]">
                    {name}
                  </span>
                </div>
                {connected[platform] && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-[#22C55E]">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Connected
                  </span>
                )}
              </div>
              {connected[platform] ? (
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#64748B]">
                    {DEMO_POSITIONS[platform].length} positions loaded
                  </span>
                  <button
                    onClick={() => handleDisconnect(platform)}
                    className="text-[11px] text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(platform)}
                  disabled={connecting === platform}
                  className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] py-2 text-[12px] font-medium text-[#64748B] hover:border-[#6366F1]/30 hover:text-[#6366F1] hover:bg-[#6366F1]/[0.03] disabled:opacity-50 transition-all duration-150"
                >
                  {connecting === platform ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Connecting...
                    </span>
                  ) : (
                    `Connect ${name}`
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#94A3B8]">
          Demo mode: simulated OAuth with sample positions. Real account linking in production.
        </p>
      </div>

      {/* Portfolio Overview */}
      {allPositions.length > 0 && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center">
              <p className="text-[20px] font-bold font-mono text-[#0F172A]">
                {allPositions.length}
              </p>
              <p className="text-[12px] text-[#64748B] mt-0.5">Positions</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center">
              <p className="text-[20px] font-bold font-mono text-[#0F172A]">
                ${totalValue.toFixed(2)}
              </p>
              <p className="text-[12px] text-[#64748B] mt-0.5">Total Value</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center">
              <p className="text-[20px] font-bold font-mono text-[#0F172A]">
                ${totalCost.toFixed(2)}
              </p>
              <p className="text-[12px] text-[#64748B] mt-0.5">Total Cost</p>
            </div>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center">
              <p
                className={`text-[20px] font-bold font-mono ${
                  totalPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                }`}
              >
                {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
              </p>
              <p className="text-[12px] text-[#64748B] mt-0.5">Unrealized P&L</p>
            </div>
          </div>

          {/* Risk Breakdown */}
          <div className="grid md:grid-cols-2 gap-5 mb-8">
            {/* By Platform */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
              <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">
                Exposure by Platform
              </h3>
              <div className="space-y-3">
                {platformBreakdown.map(({ platform, value, count }) => (
                  <div key={platform}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <PlatformBadge platform={platform} />
                        <span className="text-[12px] text-[#64748B]">
                          {count} positions
                        </span>
                      </div>
                      <span className="text-[13px] font-mono font-semibold text-[#0F172A]">
                        ${value.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F8FAFC] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#6366F1] transition-all duration-500"
                        style={{
                          width: `${totalValue > 0 ? (value / totalValue) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By Category */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
              <h3 className="text-[14px] font-semibold text-[#0F172A] mb-4">
                Exposure by Category
              </h3>
              <div className="space-y-3">
                {Object.entries(categoryBreakdown).map(([cat, value]) => {
                  const colors: Record<string, string> = {
                    Politics: "#3B82F6",
                    Economy: "#F59E0B",
                    Crypto: "#8B5CF6",
                  };
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: colors[cat] || "#94A3B8" }}
                          />
                          <span className="text-[13px] font-medium text-[#0F172A]">
                            {cat}
                          </span>
                        </div>
                        <span className="text-[13px] font-mono font-semibold text-[#0F172A]">
                          ${value.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F8FAFC] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${totalValue > 0 ? (value / totalValue) * 100 : 0}%`,
                            backgroundColor: colors[cat] || "#94A3B8",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Positions Table */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E2E8F0]">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                All Positions
              </h3>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {allPositions.map((pos) => {
                const pnl =
                  pos.quantity *
                  ((pos.currentPrice ?? pos.avgPrice) - pos.avgPrice);
                return (
                  <div
                    key={pos.id}
                    className="px-5 py-3 flex items-center gap-4 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <PlatformBadge platform={pos.platform} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#0F172A] truncate">
                        {pos.marketTitle}
                      </p>
                    </div>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold font-mono ${
                        pos.side === "YES"
                          ? "bg-[#10B981]/8 text-[#059669] border-[#10B981]/20"
                          : "bg-[#EF4444]/8 text-[#DC2626] border-[#EF4444]/20"
                      }`}
                    >
                      {pos.side}
                    </span>
                    <span className="text-[12px] font-mono text-[#64748B] w-16 text-right">
                      {pos.quantity} qty
                    </span>
                    <span className="text-[12px] font-mono text-[#64748B] w-20 text-right">
                      ${pos.avgPrice.toFixed(2)} avg
                    </span>
                    <span className="text-[12px] font-mono text-[#64748B] w-20 text-right">
                      ${(pos.currentPrice ?? pos.avgPrice).toFixed(2)} now
                    </span>
                    <span
                      className={`text-[12px] font-mono font-semibold w-20 text-right ${
                        pnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"
                      }`}
                    >
                      {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {allPositions.length === 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="text-[15px] font-medium text-[#0F172A] mb-1">
            No accounts connected
          </p>
          <p className="text-[13px] text-[#64748B]">
            Connect your Polymarket or Kalshi account above to view your positions and get AI-powered hedge recommendations.
          </p>
        </div>
      )}
    </div>
  );
}
