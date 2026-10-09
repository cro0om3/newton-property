import OpenAI from "openai";
import { secretValue } from "./env-file";
import { pdfVisualPages } from "./pdf";

const TRANSCRIBE = `You transcribe one page of a real-estate brochure. The page may be a picture with no text layer.
Copy every visible word and number exactly as printed, including words inside a floor plan.
- Do not summarize, translate, round, or calculate.
- Keep commas and decimals.
- Put a table header on one line, then one line per row.
- If a word is unreadable, write [unclear].
- If the page has no words, reply with [no text] only.`;

const FLOOR_PLAN = `You read the floor-plan drawings on one brochure page. Ignore prices and marketing paragraphs.
For each distinct unit drawing, write one line:
Unit type | bathrooms N | maid yes or no | labels: the room labels you counted
Rules:
- Count a bathroom only when its room is labeled Bath, Bathroom, WC, Toilet, or Powder.
- Count a maid's room only when it is labeled Maid, Maids, Maid's Room, or خادمة.
- Do not count a room that has no label.
- Do not invent a unit that is not drawn.
- If the page has no floor plan, reply [no floor plan] only.`;

export async function readBrochure(buffer: Buffer) {
  const pages = await pdfVisualPages(buffer);
  if (!pages.length) return "";
  const key = secretValue("OPENAI_API_KEY");
  if (!key) return "";
  const openai = new OpenAI({ apiKey: key });
  const model = secretValue("OPENAI_MODEL") || "gpt-6.1-sol";
  const blocks: string[] = [];

  for (const page of pages) {
    const image = `data:${page.mime};base64,${page.image.toString("base64")}`;
    const text = await ask(openai, model, TRANSCRIBE, `Transcribe page ${page.page}.`, image);
    if (text && text !== "[no text]") blocks.push(`[Brochure page ${page.page}]\n${text}`);
    const plan = await ask(openai, model, FLOOR_PLAN, `Read the floor plans on page ${page.page}.`, image);
    if (plan && plan !== "[no floor plan]") blocks.push(`[Floor plan page ${page.page}]\n${plan}`);
  }

  return blocks.join("\n\n").slice(0, 80000);
}

async function ask(openai: OpenAI, model: string, instructions: string, text: string, image: string) {
  const response = await openai.responses.create({
    model,
    store: false,
    reasoning: { effort: "medium" },
    instructions,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text },
          { type: "input_image", detail: "high", image_url: image },
        ],
      },
    ],
  });
  return response.output_text?.trim() || "";
}
