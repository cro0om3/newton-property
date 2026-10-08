import { NextResponse } from "next/server";
import { assignChatDeveloper, deleteChat, listMessages, renameChat } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ jid: string }> }) {
  const { jid } = await context.params;
  let chatJid = jid;
  try {
    chatJid = decodeURIComponent(jid);
  } catch {
    chatJid = jid;
  }
  return NextResponse.json({ messages: listMessages(chatJid) });
}

export async function PATCH(request: Request, context: { params: Promise<{ jid: string }> }) {
  const { jid } = await context.params;
  let chatJid = jid;
  try {
    chatJid = decodeURIComponent(jid);
  } catch {
    chatJid = jid;
  }
  const body = (await request.json().catch(() => ({}))) as { name?: string; developer?: string };
  if (body.developer !== undefined) {
    if (!assignChatDeveloper(chatJid, String(body.name || ""), String(body.developer || ""))) {
      return NextResponse.json({ error: "Could not save" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
  if (!renameChat(chatJid, String(body.name || ""))) {
    return NextResponse.json({ error: "Could not rename" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ jid: string }> }) {
  const { jid } = await context.params;
  let chatJid = jid;
  try {
    chatJid = decodeURIComponent(jid);
  } catch {
    chatJid = jid;
  }
  if (!deleteChat(chatJid)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
