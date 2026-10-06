import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { mediaDir, queueReply } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;

function extension(name: string, mime: string) {
  const fromName = path.extname(name).toLowerCase();
  if (fromName && fromName.length <= 8) return fromName;
  if (mime === "application/pdf") return ".pdf";
  if (mime.startsWith("image/")) return `.${mime.slice(6).replace("jpeg", "jpg")}`;
  if (mime.startsWith("video/")) return `.${mime.slice(6)}`;
  return ".bin";
}

function allowed(mime: string, name: string) {
  const lower = name.toLowerCase();
  return (
    mime.startsWith("image/") ||
    mime.startsWith("video/") ||
    mime === "application/pdf" ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsx")
  );
}

export async function POST(request: Request, context: { params: Promise<{ jid: string }> }) {
  const { jid } = await context.params;
  let chatJid = jid;
  try {
    chatJid = decodeURIComponent(jid);
  } catch {
    chatJid = jid;
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file" }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "File must be under 20 MB" }, { status: 400 });
  const mime = file.type || "application/octet-stream";
  if (!allowed(mime, file.name)) return NextResponse.json({ error: "Use a photo, video, or PDF" }, { status: 400 });
  const stored = `${randomUUID()}${extension(file.name, mime)}`;
  await writeFile(path.join(mediaDir(), stored), Buffer.from(await file.arrayBuffer()));
  const caption = String(form?.get("caption") || "");
  const id = queueReply(chatJid, caption, { file: stored, mime: mime === "application/octet-stream" && file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : mime });
  if (!id) return NextResponse.json({ error: "Could not queue" }, { status: 400 });
  return NextResponse.json({ id, status: "pending" });
}
