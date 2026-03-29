import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { getSagaWithLegs } from "@/lib/execution/saga";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sagaId: string }> }
) {
  const authError = authenticate(req);
  if (authError) return authError;

  try {
    const { sagaId } = await params;
    const saga = await getSagaWithLegs(sagaId);

    if (!saga) {
      return NextResponse.json({ error: "Saga not found" }, { status: 404 });
    }

    return NextResponse.json({ data: saga });
  } catch (err) {
    console.error("[API /execution] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch saga status" },
      { status: 500 }
    );
  }
}
