import { NextResponse } from "next/server";
import { disconnectMeta, metaStatus } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(metaStatus());
}

export async function POST() {
  disconnectMeta();
  return NextResponse.json(metaStatus());
}
