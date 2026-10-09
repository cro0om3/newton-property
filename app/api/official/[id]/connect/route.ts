import { NextResponse } from "next/server";
import { officialAuthUrl, officialNetwork, officialState, officialStatus, officialVerifier } from "@/lib/official";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const network = officialNetwork(id);
  const ready = officialStatus().find((item) => item.id === id);
  if (!network || network.mode !== "oauth" || !ready?.configured) {
    return NextResponse.json({ error: "This network is not ready to connect" }, { status: 400 });
  }
  const state = officialState();
  const verifier = officialVerifier();
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(officialAuthUrl(id, origin, state, verifier));
  response.cookies.set("official_state", `${id}:${state}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  response.cookies.set("official_verifier", verifier, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
