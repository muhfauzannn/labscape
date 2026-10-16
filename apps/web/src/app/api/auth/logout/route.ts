import { NextRequest, NextResponse } from "next/server";
import { endSession } from "@/features/auth/server/auth";
import { hasAllowedOrigin } from "@/features/auth/server/origin";

export async function POST(request: NextRequest) {
  if (!hasAllowedOrigin(request)) {
    return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  }
  endSession(request.cookies.get("labai_session")?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("labai_session");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
