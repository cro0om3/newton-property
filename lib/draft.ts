import OpenAI from "openai";
import { hasOpenAiKey } from "./analyze";
import { formatPrice } from "./format";
import type { CardRow, MessageRow } from "./types";

function localDraft(card: CardRow | null, recent: string) {
  const arabic = /[\u0600-\u06FF]/.test(recent);
  const place = [card?.area, card?.city].filter(Boolean).join(", ");
  const price = card ? formatPrice(card.price, card.currency) : "";
  if (arabic) {
    const bits = [
      "مرحبا، معك نيوتن بروبرتي.",
      card?.title ? `بخصوص ${card.title}${place ? ` في ${place}` : ""}.` : "",
      price && price !== "Price not set" ? `السعر المذكور عندنا ${price}.` : "",
      "إذا يناسبك أرسل لك خطة الدفع ونرتب معاينة.",
    ];
    return bits.filter(Boolean).join(" ");
  }
  const bits = [
    "Hello, this is Newton Property.",
    card?.title ? `Regarding ${card.title}${place ? ` in ${place}` : ""}.` : "",
    price && price !== "Price not set" ? `The price we have is ${price}.` : "",
    "I can send the payment plan and arrange a viewing.",
  ];
  return bits.filter(Boolean).join(" ");
}

export async function draftReply(card: CardRow | null, messages: MessageRow[]) {
  const recent = messages
    .slice(-8)
    .map((message) => `${message.from_me ? "Broker" : "Customer"}: ${(message.body || "").slice(0, 500)}`)
    .join("\n");
  if (!hasOpenAiKey()) {
    return { text: localDraft(card, recent), source: "desk" as const };
  }
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const facts = card
    ? `${card.title || ""} | ${card.area || ""} ${card.city || ""} | ${formatPrice(card.price, card.currency)} | ${card.summary || ""}`
    : "No property card is linked.";
  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-6.1-sol",
    store: false,
    reasoning: { effort: "low" },
    instructions:
      "Draft one short WhatsApp reply for a Newton Property broker. Use only the facts given. Do not invent prices, dates, discounts, or availability. Match the customer's language. Plain text, under 500 characters.",
    input: `Property facts:\n${facts}\n\nRecent chat:\n${recent || "No earlier messages."}`,
  });
  const text = response.output_text.trim();
  return { text: text || localDraft(card, recent), source: "openai" as const };
}
