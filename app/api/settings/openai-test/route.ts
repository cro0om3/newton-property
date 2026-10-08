import { NextResponse } from "next/server";
import OpenAI from "openai";
import { secretValue } from "@/lib/env-file";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const typed = body && typeof body === "object" && typeof body.key === "string" ? body.key.trim() : "";
  const key = typed || secretValue("OPENAI_API_KEY");
  if (!key) return NextResponse.json({ error: "Paste a ChatGPT API key first" }, { status: 400 });
  try {
    const openai = new OpenAI({ apiKey: key });
    await openai.models.list();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ChatGPT rejected the key";
    return NextResponse.json({ error: message.replace(/sk-[a-zA-Z0-9_-]+/g, "sk-…").slice(0, 180) }, { status: 400 });
  }
}
