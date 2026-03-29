import { NextRequest, NextResponse } from "next/server";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60_000; // 1 minute

export function authenticate(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid authorization header" },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const expectedToken = process.env.AUTH_TOKEN;

  if (!expectedToken || token !== expectedToken) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Simple rate limiting
  const now = Date.now();
  const entry = rateLimitMap.get(token);

  if (entry && now < entry.resetAt) {
    if (entry.count >= RATE_LIMIT) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 10 requests per minute." },
        { status: 429 }
      );
    }
    entry.count++;
  } else {
    rateLimitMap.set(token, { count: 1, resetAt: now + RATE_WINDOW });
  }

  return null; // authenticated
}
