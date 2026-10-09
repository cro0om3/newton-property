import { NextResponse } from "next/server";
import { createCard, listCardFiles, listCards } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cards = listCards({
    kind: url.searchParams.get("kind") || undefined,
    propertyType: url.searchParams.get("type") || undefined,
    purpose: url.searchParams.get("purpose") || undefined,
    status: url.searchParams.get("status") || undefined,
    q: url.searchParams.get("q") || undefined,
    supplierId: url.searchParams.get("supplier") || undefined,
    developerId: url.searchParams.get("developer") || undefined,
    broker: url.searchParams.get("assignee") || undefined,
  });
  const files = listCardFiles();
  const withFiles = cards.map((card) => ({
    ...card,
    sources: files
      .filter((file) => file.cardId === card.id)
      .map((file) => ({
        file: file.file,
        name: (file.body || "").split("\n").find((line) => line.toLowerCase().includes(".pdf"))?.trim() || file.file,
      })),
  }));
  return NextResponse.json({ cards: withFiles });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const input = body as Record<string, unknown>;
  const kind = input.kind === "inquiry" ? "inquiry" : input.kind === "listing" ? "listing" : null;
  const title = String(input.title || "").trim();
  if (!kind || !title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const numberOrNull = (value: unknown) => {
    if (value == null || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const settings = getSettings();
  const id = createCard({
    kind,
    title,
    purpose: typeof input.purpose === "string" && input.purpose ? input.purpose : null,
    propertyType: typeof input.propertyType === "string" && input.propertyType ? input.propertyType : null,
    city: String(input.city || "").trim() || settings.defaultCity || null,
    area: String(input.area || "").trim() || null,
    price: numberOrNull(input.price),
    bedrooms: numberOrNull(input.bedrooms),
    broker: String(input.broker || "").trim() || settings.defaultBroker || null,
    summary: String(input.summary || "").trim() || null,
    senderName: String(input.senderName || "").trim() || null,
    senderPhone: String(input.senderPhone || "").trim() || null,
    chatJid: String(input.chatJid || "").trim() || null,
    messageId: String(input.messageId || "").trim() || null,
  });
  return NextResponse.json({ id });
}
