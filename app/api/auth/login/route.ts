import { NextResponse } from "next/server";
import { codesMatch, sessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = String((body as { code?: string }).code || "");
  if (!codesMatch(code)) {
    return NextResponse.json({ error: "Wrong code" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("pd_session", await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
