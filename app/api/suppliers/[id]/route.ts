import { NextResponse } from "next/server";
import { assignChatDeveloper, deleteDeveloper, getDeveloper, listDevelopers, listPrivateChats, listSuppliers, renameDeveloper } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const developer = getDeveloper(id);
  if (!developer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const employees = listSuppliers().filter((person) => person.company_id === id);
  return NextResponse.json({ developer, employees, chats: listPrivateChats(), developers: listDevelopers() });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { name?: string; chatJid?: string; employeeName?: string };
  if (body.chatJid) {
    const developer = getDeveloper(id);
    if (!developer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!assignChatDeveloper(body.chatJid, String(body.employeeName || ""), developer.name)) {
      return NextResponse.json({ error: "Could not add" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id });
  }
  const nextId = renameDeveloper(id, String(body.name || ""));
  if (!nextId) return NextResponse.json({ error: "Could not rename" }, { status: 400 });
  return NextResponse.json({ ok: true, id: nextId });
}

export async function DELETE(_request: Request, context: Context) {
  const { id } = await context.params;
  if (!deleteDeveloper(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
