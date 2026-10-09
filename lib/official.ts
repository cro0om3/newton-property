import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { insertMessage, upsertChat } from "./db";
import { secretValue } from "./env-file";

export type OfficialNetwork = {
  id: string;
  name: string;
  mode: "oauth" | "token" | "none";
  detail: string;
  keys: string[];
};

export const OFFICIAL_NETWORKS: OfficialNetwork[] = [
  {
    id: "tiktok",
    name: "TikTok",
    mode: "oauth",
    detail: "Official TikTok login. Publishing and business messages still need TikTok to approve the app.",
    keys: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    mode: "oauth",
    detail: "Official login for a company Page. Posts and comments can be read. LinkedIn does not give private messages to outside apps.",
    keys: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
  },
  {
    id: "youtube",
    name: "YouTube",
    mode: "oauth",
    detail: "Official Google login. Comments on your channel can be read.",
    keys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    id: "x",
    name: "X",
    mode: "oauth",
    detail: "Official X login. Reading posts and direct messages needs X's paid developer access.",
    keys: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
  },
  {
    id: "telegram",
    name: "Telegram",
    mode: "token",
    detail: "Official bot. Create a bot with BotFather, paste the token, and people can message that bot.",
    keys: ["A bot token from BotFather"],
  },
  {
    id: "snapchat",
    name: "Snapchat",
    mode: "none",
    detail: "Snap's official kit does not deliver customer chats into another app. Posts are still sent by hand.",
    keys: [],
  },
];

type Link = { account: string; token: string; refresh?: string; offset?: number };

type Store = Partial<Record<string, Link>>;

function filePath() {
  return path.join(process.cwd(), "data", "official.json");
}

function readStore(): Store {
  try {
    return JSON.parse(readFileSync(filePath(), "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  mkdirSync(path.dirname(filePath()), { recursive: true });
  writeFileSync(filePath(), JSON.stringify(store));
}

export function officialStatus() {
  const store = readStore();
  return OFFICIAL_NETWORKS.map((network) => ({
    id: network.id,
    name: network.name,
    mode: network.mode,
    detail: network.detail,
    keys: network.keys,
    configured: network.mode !== "oauth" || network.keys.every((key) => Boolean(secretValue(key))),
    connected: Boolean(store[network.id]?.account),
    account: store[network.id]?.account || "",
  }));
}

export function officialNetwork(id: string) {
  return OFFICIAL_NETWORKS.find((network) => network.id === id) || null;
}

export function officialState() {
  return randomBytes(16).toString("hex");
}

export function officialVerifier() {
  return randomBytes(32).toString("base64url");
}

function challenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function officialAuthUrl(id: string, origin: string, state: string, verifier: string) {
  const redirect = `${origin}/api/official/${id}/callback`;
  if (id === "tiktok") {
    const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
    url.searchParams.set("client_key", secretValue("TIKTOK_CLIENT_KEY"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "user.info.basic");
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    return url.toString();
  }
  if (id === "linkedin") {
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", secretValue("LINKEDIN_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "openid profile");
    return url.toString();
  }
  if (id === "youtube") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", secretValue("GOOGLE_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.readonly");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }
  if (id === "x") {
    const url = new URL("https://twitter.com/i/oauth2/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", secretValue("X_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "tweet.read users.read dm.read offline.access");
    url.searchParams.set("code_challenge", challenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }
  return "";
}

async function formPost(url: string, body: URLSearchParams, headers?: HeadersInit) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const json = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) throw new Error(String(json?.error_description || json?.error || "The network refused the login"));
  return json || {};
}

export async function finishOfficialLogin(id: string, code: string, origin: string, verifier: string) {
  const redirect = `${origin}/api/official/${id}/callback`;
  let token = "";
  let account = "";
  if (id === "tiktok") {
    const body = new URLSearchParams({
      client_key: secretValue("TIKTOK_CLIENT_KEY"),
      client_secret: secretValue("TIKTOK_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirect,
    });
    const json = await formPost("https://open.tiktokapis.com/v2/oauth/token/", body);
    token = String(json.access_token || "");
    const info = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=display_name", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const profile = (await info.json().catch(() => null)) as { data?: { user?: { display_name?: string } } } | null;
    account = profile?.data?.user?.display_name || "TikTok account";
  } else if (id === "linkedin") {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      client_id: secretValue("LINKEDIN_CLIENT_ID"),
      client_secret: secretValue("LINKEDIN_CLIENT_SECRET"),
    });
    const json = await formPost("https://www.linkedin.com/oauth/v2/accessToken", body);
    token = String(json.access_token || "");
    const info = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const profile = (await info.json().catch(() => null)) as { name?: string } | null;
    account = profile?.name || "LinkedIn account";
  } else if (id === "youtube") {
    const body = new URLSearchParams({
      code,
      client_id: secretValue("GOOGLE_CLIENT_ID"),
      client_secret: secretValue("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirect,
      grant_type: "authorization_code",
    });
    const json = await formPost("https://oauth2.googleapis.com/token", body);
    token = String(json.access_token || "");
    const info = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const profile = (await info.json().catch(() => null)) as { items?: Array<{ snippet?: { title?: string } }> } | null;
    account = profile?.items?.[0]?.snippet?.title || "YouTube channel";
  } else if (id === "x") {
    const basic = Buffer.from(`${secretValue("X_CLIENT_ID")}:${secretValue("X_CLIENT_SECRET")}`).toString("base64");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirect,
      code_verifier: verifier,
    });
    const json = await formPost("https://api.twitter.com/2/oauth2/token", body, { Authorization: `Basic ${basic}` });
    token = String(json.access_token || "");
    const info = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const profile = (await info.json().catch(() => null)) as { data?: { username?: string } } | null;
    account = profile?.data?.username ? `@${profile.data.username}` : "X account";
  } else {
    throw new Error("This network has no official login");
  }
  if (!token) throw new Error("No access token came back");
  const store = readStore();
  store[id] = { account, token };
  writeStore(store);
  return account;
}

export function disconnectOfficial(id: string) {
  const store = readStore();
  delete store[id];
  writeStore(store);
}

export async function saveTelegramBot(token: string) {
  const clean = token.trim();
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(clean)) throw new Error("That is not a bot token");
  const response = await fetch(`https://api.telegram.org/bot${clean}/getMe`, { signal: AbortSignal.timeout(15000) });
  const body = (await response.json().catch(() => null)) as { ok?: boolean; result?: { username?: string } } | null;
  if (!response.ok || !body?.ok) throw new Error("Telegram did not accept this token");
  const store = readStore();
  store.telegram = { account: body.result?.username ? `@${body.result.username}` : "Telegram bot", token: clean, offset: store.telegram?.offset };
  writeStore(store);
  return store.telegram.account;
}

export async function pullTelegram() {
  const link = readStore().telegram;
  if (!link?.token) return;
  const offset = link.offset || 0;
  const response = await fetch(`https://api.telegram.org/bot${link.token}/getUpdates?timeout=0${offset ? `&offset=${offset}` : ""}`, {
    signal: AbortSignal.timeout(20000),
  });
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    result?: Array<{ update_id: number; message?: { message_id: number; text?: string; date: number; chat: { id: number; first_name?: string; username?: string } } }>;
  } | null;
  if (!response.ok || !body?.ok || !body.result?.length) return;
  let next = offset;
  for (const update of body.result) {
    next = update.update_id + 1;
    const message = update.message;
    const text = message?.text?.trim();
    if (!message || !text) continue;
    const jid = `telegram:${message.chat.id}`;
    const name = message.chat.first_name || message.chat.username || "Telegram contact";
    upsertChat({
      jid,
      name,
      isGroup: false,
      lastMessageAt: message.date * 1000,
      lastPreview: text.slice(0, 140),
    });
    insertMessage({
      id: `telegram:${message.chat.id}:${message.message_id}`,
      chat_jid: jid,
      sender_name: name,
      sender_phone: null,
      from_me: 0,
      body: `[Telegram] ${text}`,
      message_type: "chat",
      media_file: null,
      media_mime: null,
      latitude: null,
      longitude: null,
      timestamp: message.date * 1000,
      processed: 0,
    });
  }
  const store = readStore();
  if (store.telegram) {
    store.telegram.offset = next;
    writeStore(store);
  }
}
