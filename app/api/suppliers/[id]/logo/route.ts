import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { mediaDir, setDeveloperLogo } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image" }, { status: 400 });
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Use an image under 5 MB" }, { status: 400 });
  }
  const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";
  const stored = `${randomUUID()}${ext}`;
  await writeFile(path.join(mediaDir(), stored), Buffer.from(await file.arrayBuffer()));
  if (!setDeveloperLogo(id, stored)) return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  return NextResponse.json({ logo: stored });
}
