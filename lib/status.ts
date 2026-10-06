import { readFileSync } from "node:fs";
import path from "node:path";

export type WaState = "offline" | "qr" | "connected" | "reconnecting" | "error";

export type WaStatus = {
  state: WaState;
  qrDataUrl: string | null;
  phone: string | null;
  openai: boolean;
  model: string;
  lastError: string | null;
  updatedAt: number;
};

export function emptyStatus(): WaStatus {
  return {
    state: "offline",
    qrDataUrl: null,
    phone: null,
    openai: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || "gpt-6.1-sol",
    lastError: null,
    updatedAt: 0,
  };
}

export function statusPath() {
  return path.join(process.cwd(), "data", "wa-status.json");
}

export function readStatus(): WaStatus {
  try {
    const parsed = JSON.parse(readFileSync(statusPath(), "utf8")) as WaStatus;
    if (!parsed.updatedAt || Date.now() - parsed.updatedAt > 20000) {
      return { ...parsed, state: "offline", qrDataUrl: null };
    }
    return parsed;
  } catch {
    return emptyStatus();
  }
}
