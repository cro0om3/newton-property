import { NextResponse } from "next/server";
import { finishMetaLogin } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const back = new URL("/whatsapp", origin);
  const sent = url.searchParams.get("state") || "";
  const cookie = request.headers.get("cookie") || "";
  const saved = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("meta_state="))?.slice("meta_state=".length) || "";
  const code = url.searchParams.get("code") || "";
  if (!code || !sent || sent !== decodeURIComponent(saved)) {
    back.searchParams.set("meta", "failed");
    return NextResponse.redirect(back);
  }
  try {
    await finishMetaLogin(code, origin);
    back.searchParams.set("meta", "connected");
  } catch (error) {
    back.searchParams.set("meta", "failed");
    back.searchParams.set("reason", error instanceof Error ? error.message.slice(0, 180) : "Facebook login failed");
  }
  const response = NextResponse.redirect(back);
  response.cookies.set("meta_state", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
