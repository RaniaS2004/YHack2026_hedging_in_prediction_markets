import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const authError = authenticate(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { recommendationId, marketId, platform, vote } = body;

    if (!recommendationId || !marketId || !platform || !vote) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (vote !== "up" && vote !== "down") {
      return NextResponse.json(
        { error: "Vote must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    // For hackathon: log feedback to console (Supabase table optional)
    console.log(
      `[Feedback] ${vote} on ${platform}/${marketId} (rec: ${recommendationId})`
    );

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("[Feedback] Error:", err);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}
