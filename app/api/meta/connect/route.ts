import { NextResponse } from "next/server";
import { metaAuthUrl, metaState, metaStatus } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const status = metaStatus();
  if (!status.configured) {
    return NextResponse.json({ error: "The Meta app is not set up on this computer" }, { status: 400 });
  }
  const state = metaState();
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(metaAuthUrl(origin, state));
  response.cookies.set("meta_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
