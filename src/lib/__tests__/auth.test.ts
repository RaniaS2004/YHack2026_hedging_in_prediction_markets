import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock process.env before importing
vi.stubEnv("AUTH_TOKEN", "test-token-123");

import { authenticate } from "../auth";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", { headers }) as unknown as Request;
}

// We need to cast since authenticate expects NextRequest but we're testing logic
function callAuth(headers: Record<string, string> = {}) {
  const req = {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as any;
  return authenticate(req);
}

describe("authenticate", () => {
  it("rejects missing authorization header", () => {
    const result = callAuth({});
    expect(result).not.toBeNull();
    // result is a NextResponse, check status
    expect(result!.status).toBe(401);
  });

  it("rejects invalid token", () => {
    const result = callAuth({ authorization: "Bearer wrong-token" });
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("accepts valid token", () => {
    const result = callAuth({ authorization: "Bearer test-token-123" });
    expect(result).toBeNull(); // null = authenticated
  });
});
