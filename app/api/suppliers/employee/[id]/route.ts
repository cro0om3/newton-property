import { NextResponse } from "next/server";
import { deleteEmployee, updateEmployee } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { name?: string; developer?: string };
  if (!updateEmployee(id, String(body.name || ""), String(body.developer || ""))) {
    return NextResponse.json({ error: "Could not update" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!deleteEmployee(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
