import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { mediaDir } from "@/lib/db";
import { saveSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image" }, { status: 400 });
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Use an image under 5 MB" }, { status: 400 });
  }
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const stored = `office-logo-${Date.now()}.${ext}`;
  await writeFile(path.join(mediaDir(), stored), Buffer.from(await file.arrayBuffer()));
  const settings = saveSettings({ logo: `/api/media/${stored}` });
  return NextResponse.json({ settings });
}
