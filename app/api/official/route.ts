import { NextResponse } from "next/server";
import { disconnectOfficial, officialNetwork, officialStatus, saveTelegramBot } from "@/lib/official";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ networks: officialStatus() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: string; token?: string } | null;
  const id = body?.id || "";
  if (id === "telegram" && body?.token) {
    try {
      const account = await saveTelegramBot(body.token);
      return NextResponse.json({ ok: true, account, networks: officialStatus() });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save the bot" }, { status: 400 });
    }
  }
  if (!officialNetwork(id)) return NextResponse.json({ error: "Unknown network" }, { status: 404 });
  disconnectOfficial(id);
  return NextResponse.json({ networks: officialStatus() });
}
