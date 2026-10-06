import { NextResponse } from "next/server";
import { cardMessages, getCard, recentContext } from "@/lib/db";
import { draftReply } from "@/lib/draft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const card = getCard(id);
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const linked = cardMessages(id);
  const recent = linked.length ? linked : recentContext(card.chat_jid);
  return NextResponse.json(await draftReply(card, recent));
}
