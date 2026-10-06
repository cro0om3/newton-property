import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { cardGallery, cardMessages, getCard, mediaDir } from "@/lib/db";
import { dealFacts, propertyFacts } from "@/lib/facts";
import { formatPrice } from "@/lib/format";
import type { CardExtra } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const { id } = await context.params;
  const card = getCard(id);
  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(0.027, 0.094, 0.2);
  const muted = rgb(0.36, 0.42, 0.5);
  const ink = rgb(0.05, 0.1, 0.18);

  page.drawRectangle({ x: 0, y: 782, width: 595, height: 60, color: navy });
  page.drawText("NEWTON PROPERTY", { x: 36, y: 806, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Broker sheet", { x: 36, y: 790, size: 10, font, color: rgb(0.8, 0.86, 0.95) });

  const gallery = cardGallery(cardMessages(id));
  let textLeft = 36;
  if (gallery[0]) {
    try {
      const bytes = await readFile(path.join(mediaDir(), gallery[0]));
      const image = gallery[0].endsWith(".png") ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const width = 150;
      const height = Math.min(190, (image.height / image.width) * width);
      page.drawImage(image, { x: 410, y: 570, width, height });
    } catch {
      textLeft = 36;
    }
  }

  const title = (card.title || "Untitled property").slice(0, 70);
  page.drawText(title, { x: textLeft, y: 740, size: 18, font: bold, color: ink });
  const plans = readPlans(card.extra);
  const lowest = plans.length ? Math.min(...plans.map((plan) => plan.discountedPrice || plan.price)) : card.price;
  page.drawText(formatPrice(lowest, card.currency), { x: textLeft, y: 716, size: 14, font: bold, color: navy });

  let y = 680;
  page.drawText("Property details", { x: 36, y, size: 12, font: bold, color: navy });
  y = drawFacts(page, font, bold, propertyFacts(card), y - 22, ink, muted);
  y -= 16;
  page.drawText("Deal", { x: 36, y, size: 12, font: bold, color: navy });
  y = drawFacts(page, font, bold, dealFacts(card), y - 22, ink, muted);

  if (plans.length && y > 160) {
    y -= 16;
    page.drawText("Payment plans", { x: 36, y, size: 12, font: bold, color: navy });
    y -= 18;
    for (const plan of plans.slice(0, 3)) {
      if (y < 80) break;
      page.drawText(`${plan.name}  ${formatPrice(plan.discountedPrice || plan.price, "AED")}`, {
        x: 36,
        y,
        size: 10,
        font: bold,
        color: ink,
      });
      y -= 14;
    }
  }

  page.drawText("Newton Property  ·  Sorted from WhatsApp", {
    x: 36,
    y: 28,
    size: 9,
    font,
    color: muted,
  });

  const bytes = await doc.save();
  const filename = `${(card.title || "property").replace(/[^\w]+/g, "-").slice(0, 40)}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function drawFacts(
  page: import("pdf-lib").PDFPage,
  font: import("pdf-lib").PDFFont,
  bold: import("pdf-lib").PDFFont,
  facts: Array<{ label: string; value: string }>,
  start: number,
  ink: import("pdf-lib").RGB,
  muted: import("pdf-lib").RGB,
) {
  let y = start;
  facts.forEach((item, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 36 + column * 190;
    const line = y - row * 32;
    page.drawText(item.label, { x, y: line, size: 8, font, color: muted });
    page.drawText(item.value.slice(0, 32), { x, y: line - 12, size: 11, font: bold, color: ink });
  });
  return y - Math.ceil(facts.length / 2) * 32;
}

function readPlans(raw: string | null) {
  if (!raw) return [];
  try {
    return ((JSON.parse(raw) as CardExtra).plans || []).filter((plan) => plan.price);
  } catch {
    return [];
  }
}
