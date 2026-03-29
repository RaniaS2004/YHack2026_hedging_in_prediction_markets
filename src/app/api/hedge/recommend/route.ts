import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { discoverHedges } from "@/lib/llm/hedge-discovery";

export async function POST(req: NextRequest) {
  const authError = authenticate(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { description } = body;

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing or empty 'description' field" },
        { status: 400 }
      );
    }

    if (description.length > 1000) {
      return NextResponse.json(
        { error: "Description too long (max 1000 characters)" },
        { status: 400 }
      );
    }

    const result = await discoverHedges(description.trim());

    if (result.recommendations.length === 0) {
      return NextResponse.json({
        data: result,
        message: result.fallbackUsed
          ? "Using pre-computed correlations (AI unavailable). No valid hedges found for this position. Try a different description."
          : "No valid hedges found for this position. Try a different description.",
      });
    }

    return NextResponse.json({
      data: result,
      message: result.fallbackUsed
        ? "Using pre-computed correlations (AI unavailable)"
        : undefined,
    });
  } catch (err) {
    console.error("[API /hedge/recommend] Error:", err);
    return NextResponse.json(
      { error: "Failed to discover hedges" },
      { status: 500 }
    );
  }
}
