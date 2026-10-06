import { writeFileSync } from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { mediaDir } from "./db";

export async function pdfText(buffer: Buffer) {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function savePdfImages(buffer: Buffer, pdfName: string) {
  const base = pdfName.replace(/\.pdf$/i, "");
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const extracted = await extractText(doc);
  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  const canvasImport = () => import("@napi-rs/canvas");
  const shots: Buffer[] = [];

  for (let index = 0; index < doc.numPages; index += 1) {
    const letters = (pages[index] || "").replace(/\s+/g, " ").trim().length;
    const visual = index === 0 || letters < 900;
    if (!visual) continue;
    const bytes = await renderPageAsImage(doc, index + 1, { canvasImport, width: 1400 });
    shots.push(Buffer.from(bytes));
  }

  const ordered = [...shots].sort((a, b) => b.length - a.length);
  ordered.forEach((bytes, index) => {
    const name = index === 0 ? `${base}-cover.jpg` : `${base}-p${index + 1}.jpg`;
    writeFileSync(path.join(mediaDir(), name), bytes);
  });
}
