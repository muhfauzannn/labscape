import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/features/auth/server/auth";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ message: "Permintaan tidak diizinkan." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ message: "Format permintaan tidak valid." }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") || 0) > 4096) {
    return NextResponse.json({ message: "Permintaan terlalu besar." }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return NextResponse.json({ message: "Permintaan terlalu besar." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: "Format permintaan tidak valid." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("email" in body) || !("password" in body)) {
    return NextResponse.json({ message: "Isi email dan password." }, { status: 400 });
  }
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 1024) {
    return NextResponse.json({ message: "Email atau password tidak valid." }, { status: 400 });
  }

  const result = authenticate(email.trim().toLowerCase(), password);
  if (result.status === "unavailable") {
    return NextResponse.json({ message: "Login belum tersedia. Hubungi administrator." }, { status: 503 });
  }
  if (result.status === "limited") {
    return NextResponse.json({ message: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." }, { status: 429 });
  }
  if (result.status === "invalid") {
    return NextResponse.json({ message: "Email atau password salah." }, { status: 401 });
  }

  const response = NextResponse.json({ user: result.user });
  response.cookies.set("labai_session", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: result.maxAge,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
