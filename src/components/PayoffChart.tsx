"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { PayoffTable } from "@/types";

interface PayoffChartProps {
  payoff: PayoffTable;
}

export default function PayoffChart({ payoff }: PayoffChartProps) {
  if (payoff.scenarios.length === 0) return null;

  const data = payoff.scenarios.map((s, i) => ({
    name: `S${i + 1}`,
    pnl: s.netPnl,
    label: s.label,
  }));

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <h3 className="mb-4 text-[13px] font-semibold text-[#0F172A]">
        Payoff Distribution
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F8FAFC" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            tickFormatter={(v) => `$${v}`}
            axisLine={{ stroke: "#E2E8F0" }}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-[#E2E8F0] bg-white p-2.5 text-[12px] shadow-lg">
                  <p className="font-medium text-[#0F172A]">{d.label}</p>
                  <p
                    className={`font-semibold font-mono mt-0.5 ${
                      d.pnl >= 0 ? "text-[#059669]" : "text-[#DC2626]"
                    }`}
                  >
                    {d.pnl >= 0 ? "+" : ""}${d.pnl.toFixed(2)}
                  </p>
                </div>
              );
            }}
          />
          <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="3 3" />
          <Bar
            dataKey="pnl"
            radius={[4, 4, 0, 0]}
            animationDuration={300}
            animationEasing="ease-out"
          >
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.pnl >= 0 ? "#10B981" : "#EF4444"}
                fillOpacity={0.8}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
