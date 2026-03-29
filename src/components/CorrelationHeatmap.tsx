"use client";

import { useState } from "react";
import { MarketMatch, MarketRelationship } from "@/types";

interface CorrelationHeatmapProps {
  matches: MarketMatch[];
}

const RELATIONSHIP_COLORS: Record<MarketRelationship, string> = {
  SAME_EVENT: "#3B82F6",
  MUTUALLY_EXCLUSIVE: "#EF4444",
  POSITIVELY_CORRELATED: "#F59E0B",
  NEGATIVELY_CORRELATED: "#22C55E",
  CONDITIONAL: "#8B5CF6",
  INDEPENDENT: "#E2E8F0",
};

const RELATIONSHIP_LABELS: Record<MarketRelationship, string> = {
  SAME_EVENT: "Same Event",
  MUTUALLY_EXCLUSIVE: "Mutually Excl.",
  POSITIVELY_CORRELATED: "Correlated (+)",
  NEGATIVELY_CORRELATED: "Correlated (-)",
  CONDITIONAL: "Conditional",
  INDEPENDENT: "Independent",
};

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "\u2026" : s;
}

export default function CorrelationHeatmap({ matches }: CorrelationHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<MarketMatch | null>(null);

  if (matches.length === 0) return null;

  // Build unique market list from matches
  const marketMap = new Map<string, { id: string; title: string; platform: string }>();
  for (const m of matches) {
    if (!marketMap.has(m.marketAId)) {
      marketMap.set(m.marketAId, { id: m.marketAId, title: m.marketATitle, platform: m.marketAPlatform });
    }
    if (!marketMap.has(m.marketBId)) {
      marketMap.set(m.marketBId, { id: m.marketBId, title: m.marketBTitle, platform: m.marketBPlatform });
    }
  }

  const markets = Array.from(marketMap.values()).slice(0, 12); // Cap at 12x12 for readability
  const matchLookup = new Map<string, MarketMatch>();
  for (const m of matches) {
    matchLookup.set(`${m.marketAId}:${m.marketBId}`, m);
    matchLookup.set(`${m.marketBId}:${m.marketAId}`, m);
  }

  const cellSize = 44;
  const labelWidth = 140;
  const gridSize = markets.length * cellSize;
  const svgWidth = labelWidth + gridSize + 16;
  const svgHeight = labelWidth + gridSize + 16;

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-[#0F172A]">
          Market Correlation Heatmap
        </h3>
        <span className="text-[11px] text-[#94A3B8]">
          {markets.length} markets, {matches.length} relationships
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {(Object.entries(RELATIONSHIP_COLORS) as [MarketRelationship, string][])
          .filter(([rel]) => rel !== "INDEPENDENT")
          .map(([rel, color]) => (
            <div key={rel} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: color, opacity: 0.8 }}
              />
              <span className="text-[11px] text-[#64748B]">
                {RELATIONSHIP_LABELS[rel]}
              </span>
            </div>
          ))}
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <svg width={svgWidth} height={svgHeight} className="select-none">
          {/* Row labels (left side) */}
          {markets.map((m, i) => (
            <text
              key={`row-${m.id}`}
              x={labelWidth - 8}
              y={labelWidth + i * cellSize + cellSize / 2 + 4}
              textAnchor="end"
              className="text-[10px] fill-[#64748B]"
              style={{ fontFamily: "var(--font-dm-sans)" }}
            >
              {truncate(m.title, 20)}
            </text>
          ))}

          {/* Column labels (top, rotated) */}
          {markets.map((m, j) => (
            <text
              key={`col-${m.id}`}
              x={0}
              y={0}
              textAnchor="end"
              className="text-[10px] fill-[#64748B]"
              style={{ fontFamily: "var(--font-dm-sans)" }}
              transform={`translate(${labelWidth + j * cellSize + cellSize / 2 + 4}, ${labelWidth - 8}) rotate(-45)`}
            >
              {truncate(m.title, 20)}
            </text>
          ))}

          {/* Grid cells */}
          {markets.map((row, i) =>
            markets.map((col, j) => {
              if (i === j) {
                // Diagonal
                return (
                  <rect
                    key={`${i}-${j}`}
                    x={labelWidth + j * cellSize}
                    y={labelWidth + i * cellSize}
                    width={cellSize - 2}
                    height={cellSize - 2}
                    rx={4}
                    fill="#F8FAFC"
                    stroke="#F8FAFC"
                    strokeWidth={1}
                  />
                );
              }

              const match = matchLookup.get(`${row.id}:${col.id}`);
              const color = match
                ? RELATIONSHIP_COLORS[match.relationship]
                : "#F8FAFC";
              const opacity = match
                ? 0.15 + match.matchConfidence * 0.7
                : 0.3;

              return (
                <g key={`${i}-${j}`}>
                  <rect
                    x={labelWidth + j * cellSize}
                    y={labelWidth + i * cellSize}
                    width={cellSize - 2}
                    height={cellSize - 2}
                    rx={4}
                    fill={color}
                    fillOpacity={match ? opacity : 1}
                    stroke={match ? color : "#F8FAFC"}
                    strokeWidth={1}
                    strokeOpacity={match ? 0.3 : 1}
                    className="cursor-pointer transition-opacity duration-150"
                    onMouseEnter={() => match && setHoveredCell(match)}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                  {match && (
                    <text
                      x={labelWidth + j * cellSize + (cellSize - 2) / 2}
                      y={labelWidth + i * cellSize + (cellSize - 2) / 2 + 4}
                      textAnchor="middle"
                      className="text-[10px] font-semibold pointer-events-none"
                      style={{ fontFamily: "var(--font-geist-mono)" }}
                      fill={color}
                      fillOpacity={0.9}
                    >
                      {(match.matchConfidence * 100).toFixed(0)}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-2.5 h-2.5 rounded-sm"
              style={{ backgroundColor: RELATIONSHIP_COLORS[hoveredCell.relationship] }}
            />
            <span className="text-[12px] font-semibold text-[#0F172A]">
              {RELATIONSHIP_LABELS[hoveredCell.relationship]}
            </span>
            <span className="text-[11px] font-mono text-[#64748B]">
              {(hoveredCell.matchConfidence * 100).toFixed(0)}% confidence
            </span>
          </div>
          <p className="text-[11px] text-[#64748B]">
            <span className="font-medium text-[#475569]">{truncate(hoveredCell.marketATitle, 50)}</span>
            {" "}↔{" "}
            <span className="font-medium text-[#475569]">{truncate(hoveredCell.marketBTitle, 50)}</span>
          </p>
          <p className="text-[11px] text-[#94A3B8] mt-1 italic">{hoveredCell.reasoning}</p>
        </div>
      )}
    </div>
  );
}
