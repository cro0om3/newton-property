import { NextResponse } from "next/server";
import { secretValue, writeEnvValues } from "@/lib/env-file";
import { getSettings, saveSettings } from "@/lib/settings";
import { readStatus } from "@/lib/status";
import type { DeskSettings } from "@/lib/desk-defaults";

const SOCIAL_KEYS = [
  "META_APP_ID",
  "META_APP_SECRET",
  "META_VERIFY_TOKEN",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "X_CLIENT_ID",
  "X_CLIENT_SECRET",
] as const;

function secretFlags() {
  return {
    accessCodeSet: Boolean(secretValue("ACCESS_CODE")),
    openaiKeySet: Boolean(secretValue("OPENAI_API_KEY")),
    openaiModel: secretValue("OPENAI_MODEL") || "gpt-6.1-sol",
    social: Object.fromEntries(SOCIAL_KEYS.map((key) => [key, Boolean(secretValue(key))])),
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    settings: getSettings(),
    secrets: secretFlags(),
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
  const input = body as { accessCode?: string; openaiKey?: string; openaiModel?: string; clearOpenai?: boolean; social?: Record<string, string> };
  const updates: Record<string, string> = {};
  if (typeof input.accessCode === "string" && input.accessCode.trim()) {
    const code = input.accessCode.trim();
    if (code.length < 4 || code.length > 64) return NextResponse.json({ error: "Use an access code between 4 and 64 characters" }, { status: 400 });
    updates.ACCESS_CODE = code;
  }
  if (input.clearOpenai) updates.OPENAI_API_KEY = "";
  else if (typeof input.openaiKey === "string" && input.openaiKey.trim()) updates.OPENAI_API_KEY = input.openaiKey.trim();
  if (input.social && typeof input.social === "object") {
    for (const key of SOCIAL_KEYS) {
      const value = input.social[key];
      if (typeof value !== "string" || !value.trim()) continue;
      if (value.trim().length > 400 || /\s/.test(value.trim())) return NextResponse.json({ error: "A social key looks invalid" }, { status: 400 });
      updates[key] = value.trim();
    }
  }
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
    secrets: secretFlags(),
  });
}
