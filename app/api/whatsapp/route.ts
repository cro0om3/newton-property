import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { readStatus } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(readStatus());
}

export async function POST() {
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "wa-logout"), "1");
  return NextResponse.json({ ok: true });
}
