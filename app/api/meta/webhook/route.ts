import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { secretValue } from "@/lib/env-file";
import { ingestMetaWebhook, metaChallenge } from "@/lib/meta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = metaChallenge(
    url.searchParams.get("hub.mode") || "",
    url.searchParams.get("hub.verify_token") || "",
    url.searchParams.get("hub.challenge") || "",
  );
  if (challenge == null) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = secretValue("META_APP_SECRET");
  const signature = request.headers.get("x-hub-signature-256") || "";
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (!secret || left.length !== right.length || !timingSafeEqual(left, right)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    ingestMetaWebhook(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
