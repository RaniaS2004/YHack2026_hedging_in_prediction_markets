import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { scanForArbitrage } from "@/lib/agents/arb-detector";

export async function GET(request: NextRequest) {
  const authError = authenticate(request);
  if (authError) return authError;

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  try {
    const { opportunities, matches, spreadTable, marketsScanned, lastUpdated } =
      await scanForArbitrage({ refreshPrices: refresh });

    // Extract unique categories from opportunities for filter UI
    const categories = Array.from(
      new Set([
        ...opportunities.map((o) => {
          // Infer category from market title
          const title = (o.buyMarketTitle + " " + o.sellMarketTitle).toLowerCase();
          if (title.match(/tariff|trade|import|export/)) return "trade";
          if (title.match(/bitcoin|btc|eth|crypto|sol/)) return "crypto";
          if (title.match(/trump|biden|election/)) return "politics";
          if (title.match(/fed|rate|inflation|gdp|recession/)) return "economics";
          if (title.match(/ai|openai|tech|chip/)) return "tech";
          return "general";
        }),
        ...spreadTable.map((r) => r.category),
      ])
    ).filter((c) => c !== "general");

    return NextResponse.json({
      data: {
        opportunities,
        matches: matches.filter((m) => m.relationship !== "INDEPENDENT"),
        spreadTable,
        categories,
        stats: {
          marketsScanned,
          matchesFound: matches.length,
          arbOpportunities: opportunities.length,
          sameEventMatches: matches.filter(
            (m) => m.relationship === "SAME_EVENT"
          ).length,
        },
        lastUpdated,
      },
    });
  } catch (err) {
    console.error("[Arb Scan] Error:", err);
    return NextResponse.json(
      { error: "Failed to scan for arbitrage" },
      { status: 500 }
    );
  }
}
