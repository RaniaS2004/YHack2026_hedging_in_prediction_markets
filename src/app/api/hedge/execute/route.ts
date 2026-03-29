import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { createSaga, executeSaga } from "@/lib/execution/saga";

export async function POST(req: NextRequest) {
  const authError = authenticate(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { legs } = body;

    if (!legs || !Array.isArray(legs) || legs.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty 'legs' array" },
        { status: 400 }
      );
    }

    if (legs.length > 4) {
      return NextResponse.json(
        { error: "Maximum 4 legs per saga for hackathon" },
        { status: 400 }
      );
    }

    // Validate each leg
    for (const leg of legs) {
      if (!leg.platform || !leg.marketId || !leg.side || !leg.size || !leg.price) {
        return NextResponse.json(
          { error: "Each leg requires: platform, marketId, marketTitle, side, size, price" },
          { status: 400 }
        );
      }
    }

    const sagaId = await createSaga({ legs });

    // Fire-and-forget execution (async)
    // In production: trigger Supabase Edge Function
    // For hackathon: execute in background
    executeSaga(sagaId).catch((err) =>
      console.error(`[Saga ${sagaId}] Background execution error:`, err)
    );

    return NextResponse.json({
      data: { sagaId },
      message: "Saga created and execution started",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create saga";
    const status = message.includes("spending cap") ? 400 : 500;
    console.error("[API /hedge/execute] Error:", err);
    return NextResponse.json({ error: message }, { status });
  }
}
