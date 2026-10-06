import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { mediaDir } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
};

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
    return NextResponse.json({ error: "Bad file" }, { status: 400 });
  }
  const file = path.join(mediaDir(), name);
  try {
    const bytes = await readFile(file);
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Content-Disposition": ext === "pdf" ? `inline; filename="${name}"` : "inline",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
