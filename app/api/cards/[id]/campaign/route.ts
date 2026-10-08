import { NextResponse } from "next/server";
import { addFollowUp, getCard, queueReply } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GAP_MS = 45_000;
const MAX_CLIENTS = 8;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const listing = getCard(id);
  if (!listing || listing.kind !== "listing") return NextResponse.json({ error: "Choose a property" }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { text?: string; clientIds?: string[] } | null;
  const text = String(body?.text || "").trim();
  const clientIds = [...new Set((body?.clientIds || []).filter((item) => typeof item === "string"))].slice(0, MAX_CLIENTS);
  if (!text || text.length > 1000) return NextResponse.json({ error: "Write a message under 1000 characters" }, { status: 400 });
  if (!clientIds.length) return NextResponse.json({ error: "Choose at least one client" }, { status: 400 });

  const names: string[] = [];
  let queued = 0;
  clientIds.forEach((clientId, index) => {
    const client = getCard(clientId);
    const chatJid = client?.chat_jid || "";
    if (!client || client.kind !== "inquiry" || client.status === "closed") return;
    if (!chatJid || chatJid === "desk" || chatJid.endsWith("@g.us")) return;
    const idQueued = queueReply(chatJid, text, null, Date.now() + index * GAP_MS);
    if (!idQueued) return;
    queued += 1;
    names.push(client.title || client.sender_name || "Client");
  });
  if (!queued) return NextResponse.json({ error: "Those clients have no WhatsApp chat yet" }, { status: 400 });
  addFollowUp(id, `Campaign queued to ${names.join(", ")}.`, getSettings().defaultBroker || listing.broker || "Desk");
  return NextResponse.json({ queued, gapSeconds: GAP_MS / 1000 });
}
