import "server-only";
import type { NextRequest } from "next/server";

export function hasAllowedOrigin(request: NextRequest) {
  const expected = process.env.LABAI_PUBLIC_ORIGIN || request.nextUrl.origin;
  return request.headers.get("origin") === expected;
}
