import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { mediaDir } from "./db";
import type { CardRow, ExtractedCard, MessageRow } from "./types";

const KINDS = new Set(["listing", "inquiry"]);
const PURPOSES = new Set(["sale", "rent", "buy", "seek_rent"]);
const TYPES = new Set([
  "villa",
  "apartment",
  "land",
  "office",
  "warehouse",
  "townhouse",
  "building",
  "other",
]);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          match_card_id: { type: ["string", "null"] },
          kind: { type: "string", enum: ["listing", "inquiry"] },
          purpose: { type: "string", enum: ["sale", "rent", "buy", "seek_rent"] },
          property_type: {
            type: "string",
            enum: ["villa", "apartment", "land", "office", "warehouse", "townhouse", "building", "other"],
          },
          title: { type: "string" },
          city: { type: ["string", "null"] },
          area: { type: ["string", "null"] },
          price: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          bedrooms: { type: ["integer", "null"] },
          bathrooms: { type: ["integer", "null"] },
          size_sqm: { type: ["number", "null"] },
          summary: { type: "string" },
          confidence: { type: "number" },
          needs_review: { type: "boolean" },
        },
        required: [
          "match_card_id",
          "kind",
          "purpose",
          "property_type",
          "title",
          "city",
          "area",
          "price",
          "currency",
          "bedrooms",
          "bathrooms",
          "size_sqm",
          "summary",
          "confidence",
          "needs_review",
        ],
      },
    },
  },
  required: ["items"],
} as const;

const INSTRUCTIONS = `You sort WhatsApp chats for a real-estate desk in the Gulf.
Messages may be Arabic (including Gulf dialect), English, or a mix. Photos may be the only useful clue.

Return one item per distinct property. Return an empty items array for greetings, thanks, stickers, and chatter that is not about a property.

kind:
- listing: the sender is offering a property for the company to advertise, sell, or rent out. Example: "I have a villa for sale" plus photos.
- inquiry: the sender wants to buy or rent. Example: "I want a 4-bed villa in Al Ain, budget 2.5 million".

purpose:
- sale: a listing offered for sale
- rent: a listing offered for rent
- buy: an inquiry from someone who wants to buy
- seek_rent: an inquiry from someone who wants to rent

Rules:
- Write title and summary in English. Keep place names in their usual English form when you know it (Al Ain, Dubai Marina). Otherwise keep the sender's place name.
- Do not invent price, size, bedrooms, bathrooms, city, or area. Use null when missing.
- Default currency to AED when a number is clearly money and no currency is stated.
- If several photos and texts belong to the same property, return one item.
- When a message includes text extracted from a PDF, read the whole text, not only the caption. One PDF can contain several units. Create one item per unit, including price, size, bedrooms, floor, payment plan, and handover date when they are written.
- If the new messages continue an existing open card, set match_card_id to that card id. Otherwise null.
- Set needs_review true when the property is real but important fields are missing or the message is ambiguous.
- confidence is from 0 to 1.`;

function client() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function transcribeVoice(fileName: string, mime: string | null) {
  const openai = client();
  if (!openai) return null;
  const buffer = await readFile(path.join(mediaDir(), fileName));
  const ext = fileName.split(".").pop() || "ogg";
  const file = await toFile(buffer, `note.${ext}`, { type: mime || "audio/ogg" });
  const result = await openai.audio.transcriptions.create({
    file,
    model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-transcribe",
    prompt: "Real estate voice note. Arabic or English.",
  });
  return result.text?.trim() || null;
}

function cleanItem(raw: ExtractedCard): ExtractedCard | null {
  if (!KINDS.has(raw.kind) || !PURPOSES.has(raw.purpose)) return null;
  const propertyType = TYPES.has(raw.property_type) ? raw.property_type : "other";
  const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0));
  return {
    ...raw,
    match_card_id: raw.match_card_id && raw.match_card_id !== "null" ? raw.match_card_id : null,
    property_type: propertyType,
    title: raw.title?.trim() || `${propertyType} ${raw.kind}`,
    city: raw.city?.trim() || null,
    area: raw.area?.trim() || null,
    currency: raw.currency?.trim() || (raw.price != null ? "AED" : null),
    summary: raw.summary?.trim() || "",
    confidence,
    needs_review: Boolean(raw.needs_review) || confidence < 0.55,
  };
}

async function imagePart(fileName: string) {
  const ext = (fileName.split(".").pop() || "").toLowerCase();
  const mime =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
  if (!["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return null;
  const buffer = await readFile(path.join(mediaDir(), fileName));
  if (buffer.length > 4_000_000) return null;
  return {
    type: "input_image" as const,
    detail: "auto" as const,
    image_url: `data:${mime};base64,${buffer.toString("base64")}`,
  };
}

export async function analyzeChat(input: {
  messages: MessageRow[];
  newIds: string[];
  cards: CardRow[];
}) {
  const openai = client();
  if (!openai) throw new Error("OPENAI_API_KEY is missing");

  const lines = input.messages.map((message) => {
    const who = message.from_me ? "Me" : message.sender_name || message.sender_phone || "Sender";
    const marker = input.newIds.includes(message.id) ? "NEW" : "earlier";
    const bits = [
      `[${marker}] ${who}: ${message.body || ""}`.trim(),
      message.media_file && message.message_type === "image" ? `(photo ${message.media_file})` : "",
      message.latitude != null ? `(map ${message.latitude}, ${message.longitude})` : "",
    ];
    return bits.filter(Boolean).join(" ");
  });

  const cards = input.cards.map((card) => ({
    id: card.id,
    kind: card.kind,
    purpose: card.purpose,
    property_type: card.property_type,
    title: card.title,
    city: card.city,
    area: card.area,
    price: card.price,
    summary: card.summary,
  }));

  const content: Array<
    { type: "input_text"; text: string } | { type: "input_image"; detail: "auto"; image_url: string }
  > = [
    {
      type: "input_text",
      text: `Open cards in this chat:\n${JSON.stringify(cards)}\n\nMessages:\n${lines.join("\n")}`,
    },
  ];

  const images = input.messages
    .filter((message) => message.message_type === "image" && message.media_file && input.newIds.includes(message.id))
    .slice(-6);
  for (const message of images) {
    const part = await imagePart(message.media_file!);
    if (part) {
      content.push({ type: "input_text", text: `Photo for message ${message.id}` });
      content.push(part);
    }
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-6.1-sol",
    store: false,
    reasoning: { effort: (process.env.OPENAI_REASONING as "low" | "medium" | "high" | "none") || "low" },
    instructions: INSTRUCTIONS,
    input: [{ role: "user", content }],
    text: {
      format: {
        type: "json_schema",
        name: "property_sort",
        strict: true,
        schema: SCHEMA,
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as { items: ExtractedCard[] };
  return (parsed.items || []).map(cleanItem).filter((item): item is ExtractedCard => Boolean(item));
}
