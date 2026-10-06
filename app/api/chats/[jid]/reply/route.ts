import { NextResponse } from "next/server";
import { queueReply, recentContext } from "@/lib/db";
import { draftReply } from "@/lib/draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ jid: string }> }) {
  const { jid } = await context.params;
  let chatJid = jid;
  try {
    chatJid = decodeURIComponent(jid);
  } catch {
    chatJid = jid;
  }
  const body = (await request.json().catch(() => ({}))) as { action?: string; body?: string };
  if (body.action === "draft") {
    return NextResponse.json(await draftReply(null, recentContext(chatJid)));
  }
  const id = queueReply(chatJid, String(body.body || ""));
  if (!id) return NextResponse.json({ error: "Could not queue" }, { status: 400 });
  return NextResponse.json({ id, status: "pending" });
}
