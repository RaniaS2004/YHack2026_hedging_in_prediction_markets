import Link from "next/link";

const WORKFLOW = [
  {
    step: "01",
    title: "State the risk",
    description:
      "Describe the book, the downside, and the capital exposed.",
  },
  {
    step: "02",
    title: "Build the sleeve",
    description:
      "Review direct hedges, proxy legs, and desk-style sizing.",
  },
  {
    step: "03",
    title: "Review and send",
    description:
      "Export the ticket or move into one-click execution when ready.",
  },
];

const USE_CASES = [
  {
    title: "Prediction books",
    description:
      "Offset concentrated election, macro, and policy exposure across prediction venues.",
  },
  {
    title: "Crypto and macro",
    description:
      "Turn directional downside into event-driven protection with cleaner overlays.",
  },
  {
    title: "External mandates",
    description:
      "Translate real-world risk into an executable sleeve built with event contracts.",
  },
];

const BENEFITS = [
  "All overlays are built with prediction market contracts",
  "Direct hedges and non-obvious proxies in one sleeve",
  "One-click execution only after the hedge is reviewed",
];

const METRICS = [
  {
    value: "5",
    label: "Platforms",
    sublabel: "Cross-venue hedge discovery",
  },
  {
    value: "Desk",
    label: "Workflow",
    sublabel: "Mandate, sleeve, execution",
  },
  {
    value: "AI",
    label: "Analysis",
    sublabel: "Factor search, sizing, skeptic review",
  },
  {
    value: "1-Click",
    label: "Execution",
    sublabel: "Only after the sleeve is cleared",
  },
];

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1160px] px-6 pt-16 pb-20">
      <div className="relative mb-10 overflow-hidden rounded-[32px] border border-[#E2E8F0] bg-[linear-gradient(140deg,#FFFFFF_0%,#F8FAFC_50%,rgba(99,102,241,0.08)_100%)] px-7 py-9 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:px-10 md:py-12">
        <div className="absolute right-[-80px] top-[-110px] h-[240px] w-[240px] rounded-full bg-[#6366F1]/10 blur-3xl" />
        <div className="absolute bottom-[-120px] left-[-20px] h-[220px] w-[220px] rounded-full bg-[#10B981]/10 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <div>
            <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.06em] text-[#64748B]">
              Prediction market hedge desk
            </div>
            <h1 className="mb-4 max-w-[760px] text-[42px] font-bold leading-[1.02] tracking-[-0.035em] text-[#0F172A] md:text-[58px]">
              Hedge risk
              <br />
              <span className="text-[#6366F1]">
                with prediction market contracts.
              </span>
            </h1>
            <p className="mb-6 max-w-[600px] text-[17px] leading-relaxed text-[#475569]">
              One workstation for prediction-market positions, crypto exposure,
              and external risk. Write the mandate, build the sleeve, review the
              payoff, then send the trade.
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
                  Before vs after hedge
                </p>
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                  Desk review before execution
                </h2>
              </div>
              <div className="rounded-full bg-[#10B981]/10 px-2.5 py-1 text-[11px] font-semibold text-[#059669]">
                Sleeve approved
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                      Mandate
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-[#0F172A]">
                      Auto importer exposed to tariff escalation
                    </p>
                  </div>
                  <div className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">
                    Analysis mode
                  </div>
                </div>
                <svg viewBox="0 0 100 52" className="h-32 w-full">
                  <line x1="0" y1="44" x2="100" y2="44" stroke="#CBD5E1" strokeWidth="0.8" />
                  <line x1="0" y1="26" x2="100" y2="26" stroke="#E2E8F0" strokeDasharray="3 3" strokeWidth="0.8" />
                  <polygon points="0,12 24,16 52,24 76,35 100,47 100,44 0,44" fill="rgba(239,68,68,0.10)" />
                  <polygon points="0,11 24,12 52,15 76,24 100,33 100,44 0,44" fill="rgba(16,185,129,0.12)" />
                  <polyline fill="none" stroke="#DC2626" strokeWidth="2.8" strokeLinejoin="round" strokeLinecap="round" points="0,12 24,16 52,24 76,35 100,47" />
                  <polyline fill="none" stroke="#059669" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" points="0,11 24,12 52,15 76,24 100,33" />
                </svg>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-[#64748B]">
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

              <div className="grid gap-3 sm:grid-cols-3">
                <MetricTile label="Capital At Risk" value="$250k" />
                <MetricTile label="Target Hedge Ratio" value="62%" />
                <MetricTile label="Residual Basis Risk" value="18%" />
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
                <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
                      Proposed Sleeve
                    </p>
                    <p className="mt-1 text-[13px] font-semibold text-[#0F172A]">
                      3 prediction-market legs
                    </p>
                  </div>
                  <div className="rounded-full border border-[#F59E0B]/30 bg-[#FFFBEB] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#B45309]">
                    Non-obvious proxy included
                  </div>
                </div>

                <div className="space-y-3 pt-3">
                  <TicketRow
                    market="Tariffs on Chinese goods rise by year-end"
                    detail="YES 180 @ 0.43"
                  />
                  <TicketRow
                    market="US recession probability rises above 40%"
                    detail="YES 120 @ 0.29"
                  />
                  <TicketRow
                    market="US auto imports contract year-over-year"
                    detail="YES 90 @ 0.34"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {WORKFLOW.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                  >
                    <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#6366F1] text-[11px] font-semibold text-white">
                      {item.step}
                    </div>
                    <p className="text-[13px] font-semibold text-[#0F172A]">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-10 grid gap-5 md:grid-cols-3">
        {USE_CASES.map((item) => (
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
          <div className="mb-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
              Why it works
            </p>
            <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-[#0F172A]">
              Built like a risk desk
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#DDE4F0] bg-[linear-gradient(180deg,#FFFFFF_0%,rgba(16,185,129,0.05)_100%)] p-5">
              <h3 className="mb-2 text-[17px] font-semibold text-[#0F172A]">
                Hedge workstation
              </h3>
              <p className="text-[13px] leading-relaxed text-[#64748B]">
                State the exposure, the downside, and the size. Get back a sleeve
                expressed entirely in prediction-market contracts.
              </p>
            </div>

            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
              <h3 className="mb-2 text-[17px] font-semibold text-[#0F172A]">
                Risk Review
              </h3>
              <p className="text-[13px] leading-relaxed text-[#64748B]">
                Review payoff shift, hedge ratio, residual basis risk, and
                committee feedback before sending the order.
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
        {METRICS.map((stat) => (
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

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.05em] text-[#94A3B8]">
        {label}
      </p>
      <p className="mt-1 text-[14px] font-semibold text-[#0F172A]">{value}</p>
    </div>
  );
}

function TicketRow({ market, detail }: { market: string; detail: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-[12px] leading-relaxed text-[#0F172A]">{market}</p>
      <p className="shrink-0 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1 font-mono text-[11px] font-semibold text-[#475569]">
        {detail}
      </p>
    </div>
  );
}
