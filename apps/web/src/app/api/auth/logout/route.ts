import { NextRequest, NextResponse } from "next/server";
import { endSession } from "@/features/auth/server/auth";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  }
  endSession(request.cookies.get("labscape_session")?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("labscape_session");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
