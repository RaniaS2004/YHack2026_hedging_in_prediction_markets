"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Platform, UserPosition } from "@/types";
import PlatformBadge from "@/components/PlatformBadge";
import {
  EMPTY_PORTFOLIO_ACCOUNT_STATE,
  buildMonitoringSeries,
  loadPortfolioAccountState,
  removeConnectedAccount,
  subscribePortfolioAccountState,
  upsertConnectedAccount,
} from "@/lib/portfolio/account-store";

type ConnectedDemoPlatform = "polymarket" | "kalshi" | "limitless";

const DEMO_POSITIONS: Record<Platform, UserPosition[]> = {
  polymarket: [
    {
      id: "pm-1",
      platform: "polymarket",
      marketId: "pm-house-2026",
      marketTitle: "Will Democrats win the House in 2026?",
      side: "YES",
      quantity: 145,
      avgPrice: 0.41,
      currentPrice: 0.47,
    },
    {
      id: "pm-2",
      platform: "polymarket",
      marketId: "pm-ai-order",
      marketTitle: "Will the White House issue a major AI executive order in 2026?",
      side: "NO",
      quantity: 90,
      avgPrice: 0.58,
      currentPrice: 0.51,
    },
    {
      id: "pm-3",
      platform: "polymarket",
      marketId: "pm-eth-etf",
      marketTitle: "Will spot ETH ETF inflows exceed $15B in 2026?",
      side: "YES",
      quantity: 120,
      avgPrice: 0.29,
      currentPrice: 0.36,
    },
  ],
  kalshi: [
    {
      id: "k-1",
      platform: "kalshi",
      marketId: "k-fed-above-4",
      marketTitle: "Will the Fed funds rate stay above 4.25% through September 2026?",
      side: "YES",
      quantity: 260,
      avgPrice: 0.63,
      currentPrice: 0.69,
    },
    {
      id: "k-2",
      platform: "kalshi",
      marketId: "k-core-cpi",
      marketTitle: "Will core CPI print above 3.1% in December 2026?",
      side: "NO",
      quantity: 180,
      avgPrice: 0.44,
      currentPrice: 0.39,
    },
    {
      id: "k-3",
      platform: "kalshi",
      marketId: "k-10y-above-5",
      marketTitle: "Will the US 10Y Treasury yield close above 5.0% in 2026?",
      side: "YES",
      quantity: 135,
      avgPrice: 0.34,
      currentPrice: 0.43,
    },
  ],
  limitless: [
    {
      id: "l-1",
      platform: "limitless",
      marketId: "l-china-tariffs",
      marketTitle: "Will the US announce new tariffs on Chinese consumer goods before Q4 2026?",
      side: "YES",
      quantity: 48,
      avgPrice: 0.26,
      currentPrice: 0.35,
    },
    {
      id: "l-2",
      platform: "limitless",
      marketId: "l-supply-chain",
      marketTitle: "Will global shipping disruption remain elevated through holiday 2026?",
      side: "YES",
      quantity: 34,
      avgPrice: 0.31,
      currentPrice: 0.37,
    },
    {
      id: "l-3",
      platform: "limitless",
      marketId: "l-commodity-spike",
      marketTitle: "Will industrial metal prices rise more than 15% in 2026?",
      side: "NO",
      quantity: 52,
      avgPrice: 0.57,
      currentPrice: 0.49,
    },
  ],
  myriad: [],
  opinion: [],
};

const OAUTH_PLATFORMS: { platform: ConnectedDemoPlatform; name: string; color: string }[] = [
  { platform: "polymarket", name: "Polymarket", color: "#3B82F6" },
  { platform: "kalshi", name: "Kalshi", color: "#8B5CF6" },
  { platform: "limitless", name: "Limitless", color: "#22C55E" },
];

const PLATFORM_DEMO_META: Record<
  ConnectedDemoPlatform,
  {
    defaultAccountLabel: string;
    defaultEmail: string;
    accountRefPrefix: string;
    accountRefExample: string;
    credentialPlaceholder: string;
    syncLabel: string;
  }
> = {
  polymarket: {
    defaultAccountLabel: "Election book",
    defaultEmail: "events@hedgekit.pm",
    accountRefPrefix: "PM",
    accountRefExample: "PM-4821",
    credentialPlaceholder: "pm_live_api_...",
    syncLabel: "11s ago",
  },
  kalshi: {
    defaultAccountLabel: "Macro rates sleeve",
    defaultEmail: "macro@hedgekit.ai",
    accountRefPrefix: "KAL",
    accountRefExample: "KAL-2038",
    credentialPlaceholder: "kalshi_key_prod_...",
    syncLabel: "26s ago",
  },
  limitless: {
    defaultAccountLabel: "Trade shock overlay",
    defaultEmail: "risk@hedgekit.co",
    accountRefPrefix: "LMT",
    accountRefExample: "LMT-7714",
    credentialPlaceholder: "limitless_secret_...",
    syncLabel: "43s ago",
  },
};

type ConnectionForm = {
  accountLabel: string;
  loginEmail: string;
  accountRef: string;
  apiCredential: string;
  syncMode: "read_only" | "trading";
};

const EMPTY_FORM: ConnectionForm = {
  accountLabel: "",
  loginEmail: "",
  accountRef: "",
  apiCredential: "",
  syncMode: "read_only",
};

export default function PortfolioPage() {
  const router = useRouter();
  const portfolioState = useSyncExternalStore(
    subscribePortfolioAccountState,
    loadPortfolioAccountState,
    () => EMPTY_PORTFOLIO_ACCOUNT_STATE
  );
  const accounts = portfolioState.accounts;
  const existingHedges = portfolioState.hedges;
  const [selectedPositionIds, setSelectedPositionIds] = useState<Set<string>>(new Set());
  const [pendingPlatform, setPendingPlatform] = useState<ConnectedDemoPlatform | null>(null);
  const [connectionForm, setConnectionForm] = useState<ConnectionForm>(EMPTY_FORM);
  const [connecting, setConnecting] = useState<Platform | null>(null);

  const allPositions = useMemo(
    () =>
      accounts.flatMap((account) => DEMO_POSITIONS[account.platform] ?? []),
    [accounts]
  );

  const selectedPositions = allPositions.filter((position) =>
    selectedPositionIds.has(position.id)
  );

  const totalValue = allPositions.reduce(
    (sum, p) => sum + p.quantity * (p.currentPrice ?? p.avgPrice),
    0
  );
  const totalCost = allPositions.reduce(
    (sum, p) => sum + p.quantity * p.avgPrice,
    0
  );
  const totalPnl = totalValue - totalCost;

  const platformBreakdown = accounts.map((account) => {
    const positions = DEMO_POSITIONS[account.platform];
    const value = positions.reduce(
      (sum, p) => sum + p.quantity * (p.currentPrice ?? p.avgPrice),
      0
    );
    return {
      platform: account.platform,
      value,
      count: positions.length,
      accountLabel: account.accountLabel,
    };
  });

  const categoryBreakdown = allPositions.reduce((acc, position) => {
    const title = position.marketTitle.toLowerCase();
    const category =
      title.includes("bitcoin") || title.includes("ai")
        ? "Innovation / crypto"
        : title.includes("recession") || title.includes("fed") || title.includes("cpi") || title.includes("s&p")
          ? "Macro / rates"
          : "Politics / policy";
    acc[category] = (acc[category] || 0) + position.quantity * (position.currentPrice ?? position.avgPrice);
    return acc;
  }, {} as Record<string, number>);

  const topThemes = Object.entries(categoryBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topTheme = topThemes[0];

  const hedgeableExposure = selectedPositions.length > 0 ? selectedPositions : allPositions;
  const hedgeableValue = hedgeableExposure.reduce(
    (sum, position) => sum + position.quantity * (position.currentPrice ?? position.avgPrice),
    0
  );

  function setFormField<Key extends keyof ConnectionForm>(key: Key, value: ConnectionForm[Key]) {
    setConnectionForm((current) => ({ ...current, [key]: value }));
  }

  async function handleConnect(platform: Platform) {
    if (
      !connectionForm.accountLabel.trim() ||
      !connectionForm.loginEmail.trim() ||
      !connectionForm.accountRef.trim() ||
      !connectionForm.apiCredential.trim()
    ) {
      return;
    }

    setConnecting(platform);
    await new Promise((resolve) => setTimeout(resolve, 1400));

    const platformMeta = OAUTH_PLATFORMS.find((item) => item.platform === platform);
    upsertConnectedAccount({
      platform,
      platformName: platformMeta?.name ?? platform,
      accountLabel: connectionForm.accountLabel.trim(),
      loginEmail: connectionForm.loginEmail.trim(),
      accountRef: connectionForm.accountRef.trim(),
      syncMode: connectionForm.syncMode,
      connectedAt: new Date().toISOString(),
    });

    setConnecting(null);
    setPendingPlatform(null);
    setConnectionForm(EMPTY_FORM);
  }

  function handleDisconnect(platform: Platform) {
    removeConnectedAccount(platform);
  }

  function togglePosition(positionId: string) {
    setSelectedPositionIds((current) => {
      const next = new Set(current);
      if (next.has(positionId)) next.delete(positionId);
      else next.add(positionId);
      return next;
    });
  }

  function toggleAllLoaded() {
    if (selectedPositions.length === allPositions.length) {
      setSelectedPositionIds(new Set());
      return;
    }
    setSelectedPositionIds(new Set(allPositions.map((position) => position.id)));
  }

  function sendToHedge(scope: "portfolio" | "selected_positions", positions: UserPosition[]) {
    if (positions.length === 0) return;

    const label =
      scope === "portfolio"
        ? `${accounts.length} linked account${accounts.length === 1 ? "" : "s"}`
        : `${positions.length} selected position${positions.length === 1 ? "" : "s"}`;

    const brief = positions
      .map(
        (position) =>
          `${position.side} ${position.quantity} in "${position.marketTitle}" on ${position.platform} at ${position.avgPrice.toFixed(2)}`
      )
      .join(", ");

    const params = new URLSearchParams({
      q:
        scope === "portfolio"
          ? `Portfolio hedge mandate: hedge this linked event book made of ${brief}. Build the overlay entirely with prediction market contracts.`
          : `Position hedge mandate: hedge these selected positions ${brief}. Build the overlay entirely with prediction market contracts.`,
      t: "prediction_market",
      src: "portfolio",
      scope,
      positions: positions.map((position) => position.id).join(","),
      sourceLabel: label,
      positionSnapshot: JSON.stringify(
        positions.map((position) => ({
          id: position.id,
          title: position.marketTitle,
          platform: position.platform,
          side: position.side,
          quantity: position.quantity,
        }))
      ),
    });

    router.push(`/hedge?${params.toString()}`);
  }

  const vulnerabilityNote = topTheme
    ? `${topTheme[0]} is the largest pocket of risk. Hedge that sleeve first, then decide if the residual basis risk is low enough to leave the rest of the book alone.`
    : "Connect an account to load a real-looking book, choose a sleeve, and push it into the hedge workstation.";
  const activeHedge = existingHedges[0] ?? null;
  const modeledHedgeRatio =
    activeHedge?.hedgeRatio ??
    (selectedPositions.length > 0 ? 0.48 : allPositions.length > 0 ? 0.34 : 0);
  const preHedgeDownside = Math.max(totalValue * 0.68, 100);
  const postHedgeDownside = preHedgeDownside * (1 - modeledHedgeRatio * 0.82);
  const downsideReduction = preHedgeDownside - postHedgeDownside;

  return (
    <div className="mx-auto max-w-[1240px] px-6 pb-16 pt-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
            Portfolio workstation
          </p>
          <h1 className="mt-1 text-[30px] font-bold tracking-[-0.02em] text-[#0F172A]">
            Link venues, choose risk, monitor hedges
          </h1>
          <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-[#64748B]">
            Make this feel like a real prediction-market book. Add account details,
            sync positions, hedge the whole portfolio or only the lines you care about,
            then monitor the sleeves already sitting in the account.
          </p>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
            Book status
          </p>
          <p className="mt-1 text-[16px] font-semibold text-[#0F172A]">
            {accounts.length > 0 ? `${accounts.length} account${accounts.length === 1 ? "" : "s"} linked` : "No accounts linked"}
          </p>
          <p className="mt-1 text-[12px] text-[#64748B]">
            {existingHedges.length} hedge sleeve{existingHedges.length === 1 ? "" : "s"} on book
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#E2E8F0] bg-[linear-gradient(135deg,#FFFFFF_0%,#F8FAFC_58%,rgba(99,102,241,0.06)_100%)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                  Account linking
                </p>
                <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                  Add real-looking account details
                </h2>
              </div>
              <div className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-[11px] font-semibold text-[#64748B]">
                Demo sync, real workflow
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {OAUTH_PLATFORMS.map(({ platform, name, color }) => {
                const account = accounts.find((item) => item.platform === platform);
                const platformMeta = PLATFORM_DEMO_META[platform];

                return (
                  <div
                    key={platform}
                    className={`rounded-2xl border p-4 ${
                      account
                        ? "border-[#22C55E]/30 bg-white"
                        : "border-[#E2E8F0] bg-[#F8FAFC]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-[13px] font-bold text-white"
                          style={{ backgroundColor: color }}
                        >
                          {name[0]}
                        </div>
                        <div>
                          <p className="text-[14px] font-semibold text-[#0F172A]">
                            {name}
                          </p>
                          <p className="text-[11px] text-[#94A3B8]">
                            {account ? account.accountLabel : "Needs credentials"}
                          </p>
                        </div>
                      </div>
                      {account && (
                        <span className="rounded-full bg-[#10B981]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#059669]">
                          Live
                        </span>
                      )}
                    </div>

                    {account ? (
                      <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-medium text-[#0F172A]">
                              {account.loginEmail}
                            </p>
                            <p className="mt-1 text-[11px] text-[#64748B]">
                              Ref {account.accountRef} · {account.syncMode === "trading" ? "Trading enabled" : "Read only"}
                            </p>
                          </div>
                          <span className="rounded-full border border-[#E2E8F0] bg-white px-2 py-1 text-[10px] font-semibold text-[#64748B]">
                            Sync {platformMeta.syncLabel}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[11px] text-[#64748B]">
                            {DEMO_POSITIONS[platform].length} positions on book
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDisconnect(platform)}
                            className="text-[11px] font-medium text-[#94A3B8] transition-colors hover:text-[#EF4444]"
                          >
                            Disconnect
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingPlatform(platform);
                          setConnectionForm({
                            ...EMPTY_FORM,
                            accountLabel: platformMeta.defaultAccountLabel,
                            loginEmail: platformMeta.defaultEmail,
                            accountRef: `${platformMeta.accountRefPrefix}-${Math.floor(1000 + Math.random() * 9000)}`,
                          });
                        }}
                        className="mt-4 w-full rounded-xl border border-[#D6DAF0] bg-white py-2.5 text-[12px] font-semibold text-[#4F46E5] transition-colors hover:bg-[#F8FAFC]"
                      >
                        Connect {name}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {pendingPlatform && (
              <div className="mt-5 rounded-3xl border border-[#E2E8F0] bg-white p-5">
                {(() => {
                  const pendingMeta = PLATFORM_DEMO_META[pendingPlatform];
                  return (
                    <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                      Connection details
                    </p>
                    <h3 className="text-[18px] font-semibold text-[#0F172A]">
                      Authorize {OAUTH_PLATFORMS.find((item) => item.platform === pendingPlatform)?.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPlatform(null);
                      setConnectionForm(EMPTY_FORM);
                    }}
                    className="text-[12px] font-medium text-[#94A3B8] transition-colors hover:text-[#0F172A]"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <FormField
                    label="Account label"
                    value={connectionForm.accountLabel}
                    onChange={(value) => setFormField("accountLabel", value)}
                    placeholder={pendingMeta.defaultAccountLabel}
                  />
                  <FormField
                    label="Login email"
                    value={connectionForm.loginEmail}
                    onChange={(value) => setFormField("loginEmail", value)}
                    placeholder={pendingMeta.defaultEmail}
                  />
                  <FormField
                    label="Account reference"
                    value={connectionForm.accountRef}
                    onChange={(value) => setFormField("accountRef", value)}
                    placeholder={pendingMeta.accountRefExample}
                  />
                  <FormField
                    label="API credential"
                    value={connectionForm.apiCredential}
                    onChange={(value) => setFormField("apiCredential", value)}
                    placeholder={pendingMeta.credentialPlaceholder}
                    type="password"
                  />
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1">
                    <button
                      type="button"
                      onClick={() => setFormField("syncMode", "read_only")}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                        connectionForm.syncMode === "read_only"
                          ? "bg-white text-[#0F172A] shadow-sm"
                          : "text-[#64748B]"
                      }`}
                    >
                      Read only
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormField("syncMode", "trading")}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
                        connectionForm.syncMode === "trading"
                          ? "bg-white text-[#0F172A] shadow-sm"
                          : "text-[#64748B]"
                      }`}
                    >
                      Trading enabled
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnect(pendingPlatform)}
                    disabled={connecting === pendingPlatform}
                    className="rounded-xl bg-[#0F172A] px-5 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {connecting === pendingPlatform ? "Syncing account..." : "Authorize and sync"}
                  </button>
                </div>
                    </>
                  );
                })()}
              </div>
            )}
          </section>

          {allPositions.length > 0 ? (
            <>
              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                      Unified exposure summary
                    </p>
                    <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                      What this book is really exposed to
                    </h2>
                    <p className="mt-2 max-w-[720px] text-[13px] leading-relaxed text-[#475569]">
                      {vulnerabilityNote}
                    </p>
                  </div>
                  <div className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold text-[#64748B]">
                    {platformBreakdown.length} venues synced
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard label="Positions" value={String(allPositions.length)} />
                  <StatCard label="Gross value" value={`$${totalValue.toFixed(2)}`} />
                  <StatCard label="Cost basis" value={`$${totalCost.toFixed(2)}`} />
                  <StatCard
                    label="Unrealized P&L"
                    value={`${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`}
                    positive={totalPnl >= 0}
                  />
                </div>

                <div className="mt-5">
                  <PortfolioOverlayChart
                    bookValue={totalValue}
                    preHedgeDownside={preHedgeDownside}
                    postHedgeDownside={postHedgeDownside}
                    downsideReduction={downsideReduction}
                    modeledHedgeRatio={modeledHedgeRatio}
                    existingHedgeLabel={activeHedge?.sourceLabel ?? null}
                    positions={hedgeableExposure}
                  />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <BreakdownCard
                    title="Exposure by platform"
                    rows={platformBreakdown.map((row) => ({
                      label: row.accountLabel,
                      meta: `${row.platform} · ${row.count} positions`,
                      value: row.value,
                    }))}
                    totalValue={totalValue}
                    color="#6366F1"
                  />
                  <BreakdownCard
                    title="Exposure by theme"
                    rows={Object.entries(categoryBreakdown).map(([label, value]) => ({
                      label,
                      meta: `${totalValue > 0 ? ((value / totalValue) * 100).toFixed(0) : "0"}% of loaded book`,
                      value,
                    }))}
                    totalValue={totalValue}
                    color="#10B981"
                  />
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                      Position blotter
                    </p>
                    <h3 className="text-[18px] font-semibold text-[#0F172A]">
                      Hedge specific lines or the whole book
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAllLoaded}
                    className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-[11px] font-semibold text-[#64748B] transition-colors hover:bg-[#F8FAFC]"
                  >
                    {selectedPositions.length === allPositions.length ? "Clear all" : "Select all"}
                  </button>
                </div>

                <div className="divide-y divide-[#F1F5F9]">
                  {allPositions.map((position) => {
                    const pnl =
                      position.quantity *
                      ((position.currentPrice ?? position.avgPrice) - position.avgPrice);

                    return (
                      <div
                        key={position.id}
                        className="grid gap-3 px-5 py-4 lg:grid-cols-[24px_minmax(0,1.3fr)_92px_86px_92px_92px_128px]"
                      >
                        <label className="mt-1 flex items-start justify-center">
                          <input
                            type="checkbox"
                            checked={selectedPositionIds.has(position.id)}
                            onChange={() => togglePosition(position.id)}
                            className="h-4 w-4 rounded border-[#CBD5E1] text-[#6366F1] focus:ring-[#6366F1]"
                          />
                        </label>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <PlatformBadge platform={position.platform} />
                            <p className="truncate text-[13px] font-semibold text-[#0F172A]">
                              {position.marketTitle}
                            </p>
                          </div>
                          <p className="mt-1 text-[11px] text-[#64748B]">
                            {position.side} {position.quantity} contracts · avg ${position.avgPrice.toFixed(2)}
                          </p>
                        </div>

                        <Cell label="Side" value={position.side} />
                        <Cell label="Quantity" value={String(position.quantity)} />
                        <Cell label="Mark" value={`$${(position.currentPrice ?? position.avgPrice).toFixed(2)}`} />
                        <Cell
                          label="P&L"
                          value={`${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`}
                          emphasis={pnl >= 0 ? "positive" : "negative"}
                        />

                        <button
                          type="button"
                          onClick={() => sendToHedge("selected_positions", [position])}
                          className="rounded-xl border border-[#D6DAF0] bg-[#6366F1]/[0.04] px-4 py-2 text-[12px] font-semibold text-[#4F46E5] transition-colors hover:bg-white"
                        >
                          Hedge this line
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                      Existing hedge sleeves
                    </p>
                    <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                      Monitor what is already on book
                    </h3>
                  </div>
                  <div className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-[11px] font-semibold text-[#64748B]">
                    {existingHedges.length} tracked sleeves
                  </div>
                </div>

                {existingHedges.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center">
                    <p className="text-[14px] font-medium text-[#0F172A]">
                      No portfolio hedges stored yet
                    </p>
                    <p className="mt-1 text-[12px] text-[#64748B]">
                      Send a one-click hedge from the workstation and it will show up here with sleeve health and monitoring graphs.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-2">
                    {existingHedges.map((hedge) => (
                      <HedgeMonitorCard key={hedge.id} hedge={hedge} />
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#8B5CF6]/10">
                <svg className="h-6 w-6 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-[#0F172A]">
                No accounts linked yet
              </p>
              <p className="mt-1 text-[13px] text-[#64748B]">
                Start with connection details above. This demo asks for the kind of account reference, email, and credential fields a real venue integration would need.
              </p>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
              Hedge scope
            </p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#0F172A]">
              Send risk to workstation
            </h2>

            <div className="mt-4 space-y-3">
              <ScopeCard
                label="Selected positions"
                primary={`${selectedPositions.length} line${selectedPositions.length === 1 ? "" : "s"} chosen`}
                secondary={selectedPositions.length > 0 ? `$${hedgeableValue.toFixed(2)} loaded mark` : "Choose lines from the blotter"}
              />
              <ScopeCard
                label="Entire book"
                primary={`${allPositions.length} total positions`}
                secondary={allPositions.length > 0 ? `$${totalValue.toFixed(2)} cross-venue mark` : "Link accounts first"}
              />
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => sendToHedge("selected_positions", selectedPositions)}
                disabled={selectedPositions.length === 0}
                className="w-full rounded-xl bg-[#0F172A] py-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#020617] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Hedge selected positions
              </button>
              <button
                type="button"
                onClick={() => sendToHedge("portfolio", allPositions)}
                disabled={allPositions.length === 0}
                className="w-full rounded-xl border border-[#0F172A] bg-white py-3 text-[13px] font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Hedge entire portfolio
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                What happens next
              </p>
              <div className="mt-2 space-y-2 text-[12px] leading-relaxed text-[#64748B]">
                <p>1. The workstation receives either the whole book or only the selected lines.</p>
                <p>2. One-click execution writes the hedge sleeve back into this account view.</p>
                <p>3. Portfolio monitoring tracks hedge ratio, residual basis risk, and sleeve health.</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
              On-book hedges
            </p>
            <h3 className="mt-1 text-[18px] font-semibold text-[#0F172A]">
              Existing sleeves at a glance
            </h3>
            <div className="mt-4 space-y-3">
              {existingHedges.slice(0, 3).map((hedge) => (
                <div
                  key={hedge.id}
                  className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3"
                >
                  <p className="text-[13px] font-semibold text-[#0F172A]">
                    {hedge.sourceLabel}
                  </p>
                  <p className="mt-1 text-[11px] text-[#64748B]">
                    {hedge.legs.length} legs · {hedge.status} · {(hedge.hedgeRatio * 100).toFixed(0)}% hedge ratio
                  </p>
                </div>
              ))}
              {existingHedges.length === 0 && (
                <p className="text-[12px] text-[#64748B]">
                  No sleeves on book yet.
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label>
      <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 text-[14px] text-[#0F172A] placeholder-[#94A3B8] outline-none transition-all focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10"
      />
    </label>
  );
}

function StatCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center">
      <p className={`text-[20px] font-bold font-mono ${positive === undefined ? "text-[#0F172A]" : positive ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[12px] text-[#64748B]">{label}</p>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  totalValue,
  color,
}: {
  title: string;
  rows: { label: string; meta: string; value: number }[];
  totalValue: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <p className="text-[12px] font-semibold text-[#0F172A]">{title}</p>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-[#0F172A]">{row.label}</p>
                <p className="text-[11px] text-[#94A3B8]">{row.meta}</p>
              </div>
              <span className="text-[13px] font-semibold text-[#0F172A]">
                ${row.value.toFixed(2)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#F8FAFC]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${totalValue > 0 ? (row.value / totalValue) * 100 : 0}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortfolioOverlayChart({
  bookValue,
  preHedgeDownside,
  postHedgeDownside,
  downsideReduction,
  modeledHedgeRatio,
  existingHedgeLabel,
  positions,
}: {
  bookValue: number;
  preHedgeDownside: number;
  postHedgeDownside: number;
  downsideReduction: number;
  modeledHedgeRatio: number;
  existingHedgeLabel: string | null;
  positions: UserPosition[];
}) {
  const profileSeed = positions.reduce((sum, position, index) => {
    const titleSeed = position.marketTitle
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return sum + titleSeed + position.quantity * (index + 3);
  }, positions.length * 17);
  const platformMix = new Set(positions.map((position) => position.platform)).size;
  const stepA = 4 + (profileSeed % 7);
  const stepB = 8 + ((profileSeed >> 3) % 9);
  const stepC = 12 + ((profileSeed >> 5) % 11);
  const tailLift = 18 + ((profileSeed >> 7) % 12) + platformMix * 3;
  const beforePoints = [
    [0, 16 + (profileSeed % 4)],
    [20, 16 + stepA],
    [45, 24 + stepB],
    [72, 36 + stepC],
    [100, 58 + tailLift],
  ];
  const afterPoints = beforePoints.map(([x, y], index) => {
    const protection = 4 + modeledHedgeRatio * 18 + index * (2 + platformMix);
    return [x, Math.max(14, y - protection)];
  });
  const toPolyline = (points: number[][]) =>
    points.map(([x, y]) => `${x},${y}`).join(" ");
  const beforeArea = `0,90 ${toPolyline(beforePoints)} 100,90`;
  const afterArea = `0,90 ${toPolyline(afterPoints)} 100,90`;

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
            Before vs after hedge
          </p>
          <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.02em] text-[#0F172A]">
            Show the downside actually shrinking
          </h3>
          <p className="mt-1 text-[12px] text-[#64748B]">
            {existingHedgeLabel
              ? `Live view using ${existingHedgeLabel}`
              : "Modeled overlay from the current book and selected hedge scope"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#DCFCE7] bg-[#F0FDF4] px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#16A34A]">
            Downside reduced
          </p>
          <p className="mt-1 text-[22px] font-bold text-[#166534]">
            {(preHedgeDownside > 0 ? (downsideReduction / preHedgeDownside) * 100 : 0).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
          <svg viewBox="0 0 100 90" className="h-[320px] w-full">
            <line x1="0" y1="90" x2="100" y2="90" stroke="#CBD5E1" strokeWidth="0.8" />
            <line x1="0" y1="60" x2="100" y2="60" stroke="#E2E8F0" strokeDasharray="2 2" strokeWidth="0.8" />
            <line x1="0" y1="30" x2="100" y2="30" stroke="#E2E8F0" strokeDasharray="2 2" strokeWidth="0.8" />
            <polygon points={beforeArea} fill="rgba(239,68,68,0.12)" />
            <polygon points={afterArea} fill="rgba(16,185,129,0.14)" />
            <polyline fill="none" stroke="#DC2626" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" points={toPolyline(beforePoints)} />
            <polyline fill="none" stroke="#059669" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points={toPolyline(afterPoints)} />
          </svg>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#64748B]">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626]" />
              Unhedged downside
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" />
              Portfolio plus hedge
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <MiniMetric label="Gross book" value={`$${bookValue.toFixed(0)}`} />
          <MiniMetric label="Before downside" value={`$${preHedgeDownside.toFixed(0)}`} />
          <MiniMetric label="After downside" value={`$${postHedgeDownside.toFixed(0)}`} />
          <MiniMetric label="Modeled hedge ratio" value={`${(modeledHedgeRatio * 100).toFixed(0)}%`} />
        </div>
      </div>
    </div>
  );
}

function ScopeCard({
  label,
  primary,
  secondary,
}: {
  label: string;
  primary: string;
  secondary: string;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[#0F172A]">{primary}</p>
      <p className="mt-1 text-[11px] text-[#64748B]">{secondary}</p>
    </div>
  );
}

function Cell({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: "positive" | "negative";
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
        {label}
      </p>
      <p
        className={`mt-1 text-[13px] font-semibold ${
          emphasis === "positive"
            ? "text-[#22C55E]"
            : emphasis === "negative"
              ? "text-[#EF4444]"
              : "text-[#0F172A]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function HedgeMonitorCard({ hedge }: { hedge: PortfolioHedgeRecord }) {
  const series = buildMonitoringSeries(hedge.id);
  const max = Math.max(...series);
  const min = Math.min(...series);
  const points = series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * 100;
      const y = max === min ? 24 : 44 - ((value - min) / (max - min)) * 32;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[#0F172A]">
            {hedge.sourceLabel}
          </p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            {hedge.objective} · {hedge.protectionLevel} · {hedge.legs.length} legs
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] ${
            hedge.status === "active"
              ? "bg-[#10B981]/10 text-[#059669]"
              : hedge.status === "executing"
                ? "bg-[#6366F1]/10 text-[#4F46E5]"
                : "bg-[#F59E0B]/10 text-[#B45309]"
          }`}
        >
          {hedge.status}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Hedge ratio" value={`${(hedge.hedgeRatio * 100).toFixed(0)}%`} />
        <MiniMetric label="Residual basis" value={`${(hedge.residualBasisRisk * 100).toFixed(0)}%`} />
        <MiniMetric label="Estimated spend" value={`$${hedge.estimatedSpend.toFixed(0)}`} />
      </div>

      <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-white p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
          Hedge lifecycle
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: "Opened", state: "done" },
            { label: "Active", state: hedge.status === "active" ? "current" : "done" },
            { label: "Needs rebalance", state: hedge.residualBasisRisk > 0.28 ? "current" : "idle" },
            { label: "Exit", state: "idle" },
          ].map((step, index) => (
            <div key={step.label} className="text-center">
              <div
                className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.state === "done"
                    ? "bg-[#10B981] text-white"
                    : step.state === "current"
                      ? "bg-[#6366F1] text-white"
                      : "bg-[#F8FAFC] text-[#94A3B8]"
                }`}
              >
                {index + 1}
              </div>
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                {step.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
            Sleeve health
          </p>
          <p className="text-[11px] font-medium text-[#64748B]">
            12h monitor
          </p>
        </div>
        <svg viewBox="0 0 100 48" className="mt-3 h-24 w-full overflow-visible">
          <polyline
            fill="none"
            stroke="#6366F1"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={points}
          />
        </svg>
        <div className="mt-2 flex items-center justify-between text-[11px] text-[#64748B]">
          <span>Hedge efficiency drift</span>
          <span>{series[series.length - 1].toFixed(0)} score</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {hedge.legs.map((leg) => (
          <div
            key={`${hedge.id}-${leg.marketId}`}
            className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-[#0F172A]">
                {leg.marketTitle}
              </p>
              <p className="text-[11px] text-[#64748B]">
                {leg.side} {leg.size} @ ${leg.price.toFixed(2)}
              </p>
            </div>
            <PlatformBadge platform={leg.platform} />
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[#0F172A]">{value}</p>
    </div>
  );
}
