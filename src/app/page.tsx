import Link from "next/link";

const HEDGE_CASES = [
  {
    title: "Prediction market books",
    description:
      "Offset concentrated event exposure across Polymarket, Kalshi, and adjacent venues using prediction market hedges.",
  },
  {
    title: "Crypto and macro sleeves",
    description:
      "Build protective overlays for spot, directional, and macro-sensitive positioning with prediction market contracts.",
  },
  {
    title: "Corporate risk mandates",
    description:
      "Translate tariffs, elections, regulation, and commodity shocks into actionable prediction market hedges.",
  },
];

const WORKFLOW = [
  {
    step: "01",
    title: "Mandate intake",
    description:
      "Capture the exposure, the adverse scenario, and the notional you need to protect.",
  },
  {
    step: "02",
    title: "Hedge construction",
    description:
      "Review core hedges, proxy overlays, and satellite sleeves with sizing guidance.",
  },
  {
    step: "03",
    title: "Execution",
    description:
      "Launch a one-click hedge workflow after reviewing estimated payoff impact.",
  },
];

const BENEFITS = [
  "Built for prediction-market hedging, not just scanning contracts",
  "Turns real-world risk into executable prediction-market overlays",
  "Preserves one-click execution after the hedge is fully reviewed",
];

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1160px] px-6 pt-16 pb-20">
      <div className="relative mb-10 overflow-hidden rounded-[32px] border border-[#E2E8F0] bg-[linear-gradient(140deg,#FFFFFF_0%,#F8FAFC_58%,rgba(99,102,241,0.08)_100%)] px-7 py-9 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:px-10 md:py-12">
        <div className="absolute right-[-80px] top-[-110px] h-[240px] w-[240px] rounded-full bg-[#6366F1]/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-20px] h-[220px] w-[220px] rounded-full bg-[#10B981]/10 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#64748B]">
              Prediction-market hedging for event books and real-world risk
            </div>
            <h1 className="mb-4 max-w-[760px] text-[42px] font-bold leading-[1.02] tracking-[-0.035em] text-[#0F172A] md:text-[58px]">
              Hedge real risk
              <br />
              <span className="text-[#6366F1]">
                with prediction market contracts.
              </span>
            </h1>
            <p className="mb-6 max-w-[640px] text-[17px] leading-relaxed text-[#475569]">
              HedgeKit is a hedge workstation for prediction market positions,
              crypto exposure, and external risk. Every hedge is built and
              executed through prediction market contracts. Define the mandate,
              review the hedge sleeve, and move into execution only when the
              trade is ready.
            </p>

            <div className="mb-6 flex flex-wrap gap-3">
              <Link
                href="/hedge"
                className="rounded-xl bg-[#0F172A] px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#020617]"
              >
                Open Hedge Workstation
              </Link>
              <Link
                href="/portfolio"
                className="rounded-xl border border-[#E2E8F0] bg-white px-5 py-3 text-[14px] font-semibold text-[#0F172A] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
              >
                View Portfolio Workflow
              </Link>
            </div>

            <div className="space-y-2">
              {BENEFITS.map((benefit) => (
                <div
                  key={benefit}
                  className="flex items-center gap-2 text-[13px] text-[#475569]"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#10B981]/10 text-[11px] font-bold text-[#059669]">
                    ✓
                  </span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-[#DDE4F0] bg-white/90 p-5 shadow-[0_14px_40px_rgba(99,102,241,0.10)] backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                  Operating Model
                </p>
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                  Hedge workflow
                </h2>
              </div>
              <div className="rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[11px] font-semibold text-[#059669]">
                Primary product
              </div>
            </div>

            <div className="space-y-3">
              {WORKFLOW.map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#6366F1] text-[11px] font-semibold text-white">
                      {item.step}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0F172A]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-12 grid gap-5 md:grid-cols-3">
        {HEDGE_CASES.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          >
            <p className="mb-2 text-[16px] font-semibold text-[#0F172A]">
              {item.title}
            </p>
            <p className="text-[13px] leading-relaxed text-[#64748B]">
              {item.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                Why this feels closer to trad fi
              </p>
              <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                Structured around a hedge mandate
              </h2>
            </div>
            <div className="rounded-full border border-[#10B981]/20 bg-[#10B981]/[0.06] px-3 py-1 text-[11px] font-semibold text-[#059669]">
              Desk-style flow
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#DDE4F0] bg-[linear-gradient(180deg,#FFFFFF_0%,rgba(16,185,129,0.05)_100%)] p-5">
              <h3 className="mb-2 text-[17px] font-semibold text-[#0F172A]">
                Hedge Workstation
              </h3>
              <p className="text-[13px] leading-relaxed text-[#64748B]">
                Enter event positions, external mandates, or macro exposure and
                turn them into a structured prediction-market hedge plan.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
              <h3 className="mb-2 text-[17px] font-semibold text-[#0F172A]">
                Portfolio Overlay
              </h3>
              <p className="text-[13px] leading-relaxed text-[#64748B]">
                Move from a single idea to a real hedge process with objective
                selection, sizing, and before-versus-after risk framing.
              </p>
            </div>
          </div>
        </div>

        <Link href="/arbitrage" className="group">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 transition-all duration-200 hover:border-[#6366F1]/30 hover:shadow-[0_4px_16px_rgba(99,102,241,0.08)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#3B82F6]/10">
                <svg
                  className="h-5 w-5 text-[#3B82F6]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <div className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">
                Market intelligence
              </div>
            </div>
            <h3 className="mb-2 text-[16px] font-semibold text-[#0F172A] transition-colors group-hover:text-[#6366F1]">
              Arbitrage Scanner
            </h3>
            <p className="mb-4 text-[13px] leading-relaxed text-[#64748B]">
              Compare venue dislocations, sharpen entries, and monitor pricing
              context around the prediction-market hedge you want to put on.
            </p>
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                Best used for
              </p>
              <p className="text-[12px] leading-relaxed text-[#64748B]">
                Tightening execution, comparing venue pricing, and spotting
                dislocations around an existing hedge plan.
              </p>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          {
            value: "5",
            label: "Platforms",
            sublabel: "Cross-venue hedge discovery and execution",
          },
          {
            value: "Desk",
            label: "Workflow",
            sublabel: "Mandate intake, hedge construction, execution",
          },
          {
            value: "AI",
            label: "Analysis",
            sublabel: "Correlation, sizing, and scenario-aware hedge suggestions",
          },
          {
            value: "1-Click",
            label: "Execution",
            sublabel: "Preserved as the final step, not the whole product",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center"
          >
            <p className="font-mono text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">
              {stat.value}
            </p>
            <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.05em] text-[#64748B]">
              {stat.label}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#94A3B8]">
              {stat.sublabel}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
