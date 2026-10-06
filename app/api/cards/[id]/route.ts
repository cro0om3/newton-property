import { NextResponse } from "next/server";
import { addFollowUp, cardGallery, cardMessages, ensureSupplier, getCard, getSupplier, linkSupplier, listCards, listFollowUps, updateCardDesk, updateCardDetails, updateCardStatus } from "@/lib/db";
import type { CardExtra } from "@/lib/types";
import { matchesFor } from "@/lib/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const card = getCard(id);
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supplier = ensureSupplier(card.chat_jid, card.sender_name, card.sender_phone) || (card.supplier_id ? getSupplier(card.supplier_id) : null);
  const messages = cardMessages(id);
  const matches = matchesFor(card, listCards());
  return NextResponse.json({ card: getCard(id), messages, gallery: cardGallery(messages), followUps: listFollowUps(id), matches, supplier });
}

export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: string;
    broker?: string;
    nextFollowUp?: string | null;
    note?: string;
    supplierName?: string;
    companyName?: string;
    details?: {
      title?: string;
      city?: string | null;
      area?: string | null;
      price?: number | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      sizeSqm?: number | null;
      propertyType?: string | null;
      purpose?: string | null;
      extra?: Partial<CardExtra>;
    };
  };
  if (body.status && !updateCardStatus(id, body.status)) {
    return NextResponse.json({ error: "Could not update" }, { status: 400 });
  }
  const nextFollowUp =
    body.nextFollowUp === undefined ? undefined : body.nextFollowUp ? Date.parse(`${body.nextFollowUp}T00:00:00+04:00`) : null;
  if (body.broker !== undefined || nextFollowUp !== undefined) {
    updateCardDesk(id, {
      broker: body.broker === undefined ? undefined : body.broker.trim(),
      nextFollowUp: Number.isNaN(nextFollowUp) ? null : nextFollowUp,
    });
  }
  if (body.details) updateCardDetails(id, body.details);
  if (body.supplierName !== undefined) linkSupplier(id, body.supplierName, body.companyName || "");
  const note = body.note?.trim();
  if (note) addFollowUp(id, note, body.broker?.trim() || getCard(id)?.broker || null);
  return NextResponse.json({ ok: true });
}
