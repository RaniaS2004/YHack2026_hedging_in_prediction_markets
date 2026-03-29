import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { fetchAllMarkets } from "@/lib/markets";

export async function GET(req: NextRequest) {
  const authError = authenticate(req);
  if (authError) return authError;

  try {
    const markets = await fetchAllMarkets();
    return NextResponse.json({ data: markets });
  } catch (err) {
    console.error("[API /markets] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch markets" },
      { status: 500 }
    );
  }
}
