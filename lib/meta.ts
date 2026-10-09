import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { insertMessage, upsertChat } from "./db";
import { secretValue } from "./env-file";

const GRAPH = "https://graph.facebook.com/v21.0";

type MetaPage = {
  id: string;
  name: string;
  token: string;
  instagramId: string | null;
  instagramName: string | null;
};

type MetaFile = {
  connectedAt: number;
  pages: MetaPage[];
};

export type MetaPublic = {
  configured: boolean;
  connected: boolean;
  pages: { id: string; name: string; instagramName: string | null }[];
};

function filePath() {
  return path.join(process.cwd(), "data", "meta.json");
}

function configured() {
  return Boolean(secretValue("META_APP_ID") && secretValue("META_APP_SECRET") && secretValue("META_VERIFY_TOKEN"));
}

function readFile(): MetaFile | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath(), "utf8")) as MetaFile;
    if (!parsed?.pages?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function metaStatus(): MetaPublic {
  const saved = readFile();
  return {
    configured: configured(),
    connected: Boolean(saved),
    pages: (saved?.pages || []).map((page) => ({
      id: page.id,
      name: page.name,
      instagramName: page.instagramName,
    })),
  };
}

export function metaState() {
  return randomBytes(16).toString("hex");
}

export function metaAuthUrl(origin: string, state: string) {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", secretValue("META_APP_ID"));
  url.searchParams.set("redirect_uri", `${origin}/api/meta/callback`);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "pages_show_list,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages");
  return url.toString();
}

async function graph(pathName: string, token: string) {
  const url = new URL(`${GRAPH}/${pathName}`);
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
  if (!response.ok) throw new Error(body?.error?.message || "Meta refused the request");
  return body as Record<string, unknown>;
}

export async function finishMetaLogin(code: string, origin: string) {
  if (!configured()) throw new Error("The Meta app is not set up on this computer");
  const appId = secretValue("META_APP_ID");
  const appSecret = secretValue("META_APP_SECRET");
  const redirect = `${origin}/api/meta/callback`;
  const shortUrl = new URL(`${GRAPH}/oauth/access_token`);
  shortUrl.searchParams.set("client_id", appId);
  shortUrl.searchParams.set("client_secret", appSecret);
  shortUrl.searchParams.set("redirect_uri", redirect);
  shortUrl.searchParams.set("code", code);
  const shortResponse = await fetch(shortUrl, { signal: AbortSignal.timeout(15000) });
  const short = (await shortResponse.json().catch(() => null)) as { access_token?: string; error?: { message?: string } } | null;
  if (!shortResponse.ok || !short?.access_token) throw new Error(short?.error?.message || "Facebook did not return a token");

  const longUrl = new URL(`${GRAPH}/oauth/access_token`);
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", appId);
  longUrl.searchParams.set("client_secret", appSecret);
  longUrl.searchParams.set("fb_exchange_token", short.access_token);
  const longResponse = await fetch(longUrl, { signal: AbortSignal.timeout(15000) });
  const long = (await longResponse.json().catch(() => null)) as { access_token?: string; error?: { message?: string } } | null;
  const userToken = long?.access_token || short.access_token;
  if (!longResponse.ok && !userToken) throw new Error(long?.error?.message || "Facebook did not extend the token");

  const accounts = (await graph(
    "me/accounts?fields=id,name,access_token,instagram_business_account{id,username}",
    userToken,
  )) as { data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }> };
  const pages = accounts.data || [];
  if (!pages.length) throw new Error("This Facebook account has no Page");

  const saved: MetaPage[] = [];
  for (const page of pages) {
    const subscribe = new URL(`${GRAPH}/${page.id}/subscribed_apps`);
    subscribe.searchParams.set("subscribed_fields", "messages,messaging_postbacks");
    subscribe.searchParams.set("access_token", page.access_token);
    await fetch(subscribe, { method: "POST", signal: AbortSignal.timeout(15000) });
    const instagram = page.instagram_business_account;
    if (instagram?.id) {
      const ig = new URL(`${GRAPH}/${instagram.id}/subscribed_apps`);
      ig.searchParams.set("subscribed_fields", "messages");
      ig.searchParams.set("access_token", page.access_token);
      await fetch(ig, { method: "POST", signal: AbortSignal.timeout(15000) });
    }
    saved.push({
      id: page.id,
      name: page.name,
      token: page.access_token,
      instagramId: instagram?.id || null,
      instagramName: instagram?.username || null,
    });
  }

  mkdirSync(path.dirname(filePath()), { recursive: true });
  const payload: MetaFile = { connectedAt: Date.now(), pages: saved };
  writeFileSync(filePath(), JSON.stringify(payload));
  return saved.map((page) => page.name);
}

export function disconnectMeta() {
  rmSync(filePath(), { force: true });
}

export function metaChallenge(mode: string, token: string, challenge: string) {
  const expected = secretValue("META_VERIFY_TOKEN");
  if (mode !== "subscribe" || !expected || !token) return null;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return challenge;
}

type Incoming = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean };
};

export function ingestMetaWebhook(payload: unknown) {
  const body = payload as { object?: string; entry?: Array<{ id?: string; messaging?: Incoming[] }> };
  const channel = body.object === "instagram" ? "Instagram" : body.object === "page" ? "Messenger" : "";
  if (!channel) return 0;
  const saved = readFile();
  let count = 0;
  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const text = event.message?.text?.trim();
      const mid = event.message?.mid;
      const sender = event.sender?.id;
      if (!text || !mid || !sender) continue;
      const page = saved?.pages.find((item) => item.id === entry.id || item.instagramId === entry.id);
      const fromPage = sender === page?.id || sender === page?.instagramId || Boolean(event.message?.is_echo);
      const customer = fromPage ? event.recipient?.id || sender : sender;
      const jid = `meta:${channel.toLowerCase()}:${customer}`;
      const name = fromPage ? page?.name || channel : channel;
      upsertChat({
        jid,
        name: fromPage ? name : `${channel} contact`,
        isGroup: false,
        lastMessageAt: event.timestamp || Date.now(),
        lastPreview: text.slice(0, 140),
      });
      const inserted = insertMessage({
        id: `meta:${mid}`,
        chat_jid: jid,
        sender_name: fromPage ? page?.name || channel : `${channel} contact`,
        sender_phone: null,
        from_me: fromPage ? 1 : 0,
        body: `[${channel}] ${text}`,
        message_type: "chat",
        media_file: null,
        media_mime: null,
        latitude: null,
        longitude: null,
        timestamp: event.timestamp || Date.now(),
        processed: 0,
      });
      if (inserted) count += 1;
    }
  }
  return count;
}
