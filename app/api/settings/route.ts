import { NextResponse } from "next/server";
import { secretValue, writeEnvValues } from "@/lib/env-file";
import { getSettings, saveSettings } from "@/lib/settings";
import { readStatus } from "@/lib/status";
import type { DeskSettings } from "@/lib/desk-defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    settings: getSettings(),
    secrets: {
      accessCodeSet: Boolean(secretValue("ACCESS_CODE")),
      openaiKeySet: Boolean(secretValue("OPENAI_API_KEY")),
      openaiModel: secretValue("OPENAI_MODEL") || "gpt-6.1-sol",
    },
    whatsapp: readStatus(),
  });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const settings = saveSettings(body as Partial<DeskSettings>);
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const input = body as { accessCode?: string; openaiKey?: string; openaiModel?: string; clearOpenai?: boolean };
  const updates: Record<string, string> = {};
  if (typeof input.accessCode === "string" && input.accessCode.trim()) {
    const code = input.accessCode.trim();
    if (code.length < 4 || code.length > 64) return NextResponse.json({ error: "Use an access code between 4 and 64 characters" }, { status: 400 });
    updates.ACCESS_CODE = code;
  }
  if (input.clearOpenai) updates.OPENAI_API_KEY = "";
  else if (typeof input.openaiKey === "string" && input.openaiKey.trim()) updates.OPENAI_API_KEY = input.openaiKey.trim();
  if (typeof input.openaiModel === "string" && input.openaiModel.trim()) {
    const model = input.openaiModel.trim();
    if (!/^[a-zA-Z0-9._:-]{2,80}$/.test(model)) return NextResponse.json({ error: "Use a model name such as gpt-6.1-sol" }, { status: 400 });
    updates.OPENAI_MODEL = model;
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    writeEnvValues(updates);
  } catch {
    return NextResponse.json({ error: "Could not save" }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    signedOut: "ACCESS_CODE" in updates,
    secrets: {
      accessCodeSet: Boolean(secretValue("ACCESS_CODE")),
      openaiKeySet: Boolean(secretValue("OPENAI_API_KEY")),
      openaiModel: secretValue("OPENAI_MODEL") || "gpt-6.1-sol",
    },
  });
}
