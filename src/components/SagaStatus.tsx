"use client";

import { useEffect, useState } from "react";
import PlatformBadge from "./PlatformBadge";
import { Platform } from "@/types";

interface SagaData {
  id: string;
  status: string;
  total_cost_usd: number;
  spending_cap_usd: number;
  legs: SagaLegData[];
}

interface SagaLegData {
  id: string;
  platform: Platform;
  market_title: string;
  side: string;
  size: number;
  price: number;
  fill_price: number | null;
  status: string;
  simulated: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "text-[#94A3B8] bg-[#F8FAFC] border-[#E2E8F0]",
  EXECUTING: "text-[#6366F1] bg-[#6366F1]/[0.05] border-[#6366F1]/20 animate-pulse",
  FILLED: "text-[#059669] bg-[#10B981]/[0.05] border-[#10B981]/20",
  COMPLETED: "text-[#059669] bg-[#10B981]/[0.05] border-[#10B981]/20",
  FAILED: "text-[#DC2626] bg-[#EF4444]/[0.05] border-[#EF4444]/20",
  ROLLING_BACK: "text-[#D97706] bg-[#F59E0B]/[0.05] border-[#F59E0B]/20 animate-pulse",
  ROLLED_BACK: "text-[#D97706] bg-[#F59E0B]/[0.05] border-[#F59E0B]/20",
  CANCELLED: "text-[#94A3B8] bg-[#F8FAFC] border-[#E2E8F0]",
};

interface SagaStatusProps {
  sagaId: string;
  authToken: string;
}

export default function SagaStatus({ sagaId, authToken }: SagaStatusProps) {
  const [saga, setSaga] = useState<SagaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/execution/${sagaId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (active) setSaga(json.data);
      } catch (err) {
        if (active) setError(String(err));
      }
    }

    poll();
    const interval = setInterval(poll, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [sagaId, authToken]);

  if (error) {
    return (
      <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/[0.05] p-4">
        <p className="text-[13px] text-[#DC2626]">Error loading saga: {error}</p>
      </div>
    );
  }

  if (!saga) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] p-6">
        <div className="flex items-center gap-2 text-[14px] text-[#94A3B8]">
          <svg className="animate-spin h-4 w-4 text-[#6366F1]" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Loading execution status...
        </div>
      </div>
    );
  }

  const isTerminal = ["COMPLETED", "FAILED", "ROLLED_BACK"].includes(saga.status);

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#E2E8F0]">
        <h3 className="text-[15px] font-semibold text-[#0F172A]">Execution Status</h3>
        <span
          className={`rounded-md border px-2.5 py-1 text-[12px] font-semibold ${STATUS_STYLES[saga.status] || "text-[#94A3B8] bg-[#F8FAFC] border-[#E2E8F0]"}`}
        >
          {saga.status}
        </span>
      </div>

      {saga.status === "FAILED" && (
        <div className="mx-5 mt-4 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/[0.05] p-3 text-[12px] text-[#DC2626]">
          Rollback incomplete. You may have an open position. Check manually.
        </div>
      )}

      <div className="p-5 space-y-2">
        {saga.legs.map((leg) => (
          <div
            key={leg.id}
            className="flex items-center justify-between rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3"
          >
            <div className="flex items-center gap-3">
              <PlatformBadge platform={leg.platform} />
              <div>
                <p className="text-[13px] font-medium text-[#0F172A]">
                  {leg.market_title?.slice(0, 50)}
                  {(leg.market_title?.length || 0) > 50 ? "..." : ""}
                </p>
                <p className="text-[11px] text-[#94A3B8] font-mono">
                  {leg.side} {leg.size} shares @{" "}
                  {leg.fill_price
                    ? `$${leg.fill_price.toFixed(4)} (filled)`
                    : `$${leg.price.toFixed(2)}`}
                  {leg.simulated && (
                    <span className="text-[#E2E8F0]"> [Sim]</span>
                  )}
                </p>
              </div>
            </div>
            <span
              className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[leg.status] || "text-[#94A3B8] bg-[#F8FAFC] border-[#E2E8F0]"}`}
            >
              {leg.status}
            </span>
          </div>
        ))}
      </div>

      <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between text-[11px] text-[#94A3B8] font-mono">
        <span>
          Cost: ${saga.total_cost_usd?.toFixed(2) || "0.00"} / Cap: $
          {saga.spending_cap_usd}
        </span>
        {!isTerminal && <span className="text-[#6366F1] animate-pulse">Polling 2s</span>}
      </div>
    </div>
  );
}
