import { NextResponse } from "next/server";
import { listMessages, renameChat } from "@/lib/db";

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
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  if (!renameChat(chatJid, String(body.name || ""))) {
    return NextResponse.json({ error: "Could not rename" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
