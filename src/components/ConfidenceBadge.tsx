"use client";

interface ConfidenceBadgeProps {
  confidence: number;
  level: "high" | "medium" | "speculative";
}

const LEVEL_STYLES = {
  high: "bg-[#10B981]/8 text-[#059669] border-[#10B981]/20",
  medium: "bg-[#F59E0B]/8 text-[#D97706] border-[#F59E0B]/20",
  speculative: "bg-[#EF4444]/8 text-[#DC2626] border-[#EF4444]/20",
};

const LEVEL_LABELS = {
  high: "High",
  medium: "Medium",
  speculative: "Speculative",
};

export default function ConfidenceBadge({
  confidence,
  level,
}: ConfidenceBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${LEVEL_STYLES[level]}`}
    >
      <span className="font-semibold font-mono">{(confidence * 100).toFixed(0)}%</span>
      <span>{LEVEL_LABELS[level]}</span>
    </span>
  );
}
