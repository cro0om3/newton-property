import { NextResponse } from "next/server";
import { finishOfficialLogin } from "@/lib/official";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

function cookieValue(header: string, name: string) {
  const raw = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
  return decodeURIComponent(raw);
}

export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const back = new URL("/whatsapp", url.origin);
  const header = request.headers.get("cookie") || "";
  const state = url.searchParams.get("state") || "";
  const saved = cookieValue(header, "official_state");
  const code = url.searchParams.get("code") || "";
  if (!code || saved !== `${id}:${state}`) {
    back.searchParams.set("link", "failed");
    back.searchParams.set("network", id);
    return NextResponse.redirect(back);
  }
  try {
    const account = await finishOfficialLogin(id, code, url.origin, cookieValue(header, "official_verifier"));
    back.searchParams.set("link", "connected");
    back.searchParams.set("network", id);
    back.searchParams.set("account", account);
  } catch (error) {
    back.searchParams.set("link", "failed");
    back.searchParams.set("network", id);
    back.searchParams.set("reason", error instanceof Error ? error.message.slice(0, 180) : "Login failed");
  }
  const response = NextResponse.redirect(back);
  response.cookies.set("official_state", "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set("official_verifier", "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
