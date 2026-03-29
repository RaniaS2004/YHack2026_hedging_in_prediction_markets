"use client";

import { Platform, REAL_PLATFORMS } from "@/types";

interface PlatformBadgeProps {
  platform: Platform;
}

const PLATFORM_STYLES: Record<Platform, { bg: string; text: string; border: string }> = {
  polymarket: { bg: "bg-[#A855F7]/8", text: "text-[#7C3AED]", border: "border-[#A855F7]/20" },
  kalshi: { bg: "bg-[#3B82F6]/8", text: "text-[#2563EB]", border: "border-[#3B82F6]/20" },
  limitless: { bg: "bg-[#6366F1]/8", text: "text-[#4F46E5]", border: "border-[#6366F1]/20" },
  myriad: { bg: "bg-[#F97316]/8", text: "text-[#EA580C]", border: "border-[#F97316]/20" },
  opinion: { bg: "bg-[#EC4899]/8", text: "text-[#DB2777]", border: "border-[#EC4899]/20" },
};

export default function PlatformBadge({ platform }: PlatformBadgeProps) {
  const isReal = REAL_PLATFORMS.includes(platform);
  const style = PLATFORM_STYLES[platform] || { bg: "bg-[#94A3B8]/8", text: "text-[#64748B]", border: "border-[#94A3B8]/20" };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize ${style.bg} ${style.text} ${style.border}`}
      >
        {platform}
      </span>
      {!isReal && (
        <span className="rounded border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-[10px] font-medium text-[#94A3B8]">
          Sim
        </span>
      )}
    </div>
  );
}
