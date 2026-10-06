import { NextResponse } from "next/server";
import { listCards, stats } from "@/lib/db";
import { readStatus } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ...stats(),
    recent: listCards({ kind: "listing", limit: 4 }),
    recentClients: listCards({ kind: "inquiry", limit: 4 }),
    whatsapp: readStatus(),
  });
}
