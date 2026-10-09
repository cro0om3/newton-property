import { writeFileSync } from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";
import { mediaDir } from "./db";

export async function pdfText(buffer: Buffer) {
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type PdfVisualPage = {
  page: number;
  image: Buffer;
  mime: "image/jpeg" | "image/png";
};

export async function pdfVisualPages(buffer: Buffer) {
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const extracted = await extractText(doc);
  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  const canvasImport = () => import("@napi-rs/canvas");
  const visual: PdfVisualPage[] = [];

  for (let index = 0; index < doc.numPages && visual.length < 8; index += 1) {
    const letters = (pages[index] || "").replace(/\s+/g, "").length;
    if (letters >= 80) continue;
    let width = 2000;
    let bytes = Buffer.from(await renderPageAsImage(doc, index + 1, { canvasImport, width }));
    while (bytes.length > 3_500_000 && width > 1100) {
      width -= 300;
      bytes = Buffer.from(await renderPageAsImage(doc, index + 1, { canvasImport, width }));
    }
    visual.push({ page: index + 1, image: bytes, mime: bytes[0] === 0x89 ? "image/png" : "image/jpeg" });
  }

  return visual;
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
