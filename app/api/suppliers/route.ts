import { NextResponse } from "next/server";
import { createDeveloper, listDevelopers, listSuppliers } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ suppliers: listSuppliers(), developers: listDevelopers() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const id = createDeveloper(String(body.name || ""));
  if (!id) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  return NextResponse.json({ id });
}
