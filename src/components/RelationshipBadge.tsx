"use client";

import { MarketRelationship } from "@/types";

const RELATIONSHIP_CONFIG: Record<
  MarketRelationship,
  { label: string; color: string; bg: string; border: string }
> = {
  SAME_EVENT: {
    label: "Same Event",
    color: "#3B82F6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.2)",
  },
  MUTUALLY_EXCLUSIVE: {
    label: "Mutually Exclusive",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.2)",
  },
  POSITIVELY_CORRELATED: {
    label: "Correlated (+)",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
  },
  NEGATIVELY_CORRELATED: {
    label: "Correlated (-)",
    color: "#22C55E",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.2)",
  },
  CONDITIONAL: {
    label: "Conditional",
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.08)",
    border: "rgba(139,92,246,0.2)",
  },
  INDEPENDENT: {
    label: "Independent",
    color: "#94A3B8",
    bg: "rgba(148,163,184,0.08)",
    border: "rgba(148,163,184,0.2)",
  },
};

export default function RelationshipBadge({
  relationship,
}: {
  relationship: MarketRelationship;
}) {
  const config = RELATIONSHIP_CONFIG[relationship];

  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}
