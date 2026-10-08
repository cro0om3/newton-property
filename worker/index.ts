import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestWaWebVersion,
  getContentType,
  isJidGroup,
  isJidStatusBroadcast,
  normalizeMessageContent,
  useMultiFileAuthState,
  type Chat,
  type WAMessage,
} from "@whiskeysockets/baileys";
import pino from "pino";
import QRCode from "qrcode";
import { analyzeChat, hasOpenAiKey, transcribeVoice } from "../lib/analyze";
import { pdfText, savePdfImages } from "../lib/pdf";
import {
  claimReplies,
  chatsMissingAvatars,
  clearLidPhones,
  contactName,
  finishReply,
  insertMessage,
  listPrivateLids,
  listUnnamedGroups,
  listUnprocessed,
  markProcessed,
  mediaDir,
  openCards,
  recentContext,
  rememberPhone,
  saveExtractedCard,
  sessionDir,
  setChatAvatar,
  updateMessageBody,
  upsertChat,
  upsertContact,
} from "../lib/db";
import { reloadSecrets } from "../lib/env-file";
import { getSettings } from "../lib/settings";
import { emptyStatus, statusPath, type WaStatus } from "../lib/status";
import type { MessageRow } from "../lib/types";

loadEnv();

const logger = pino({ level: "silent" });
let liveSock: ReturnType<typeof makeWASocket> | null = null;

function keepMs() {
  return getSettings().historyDays * 24 * 60 * 60 * 1000;
}

function analyzeMs() {
  return getSettings().analyzeHours * 60 * 60 * 1000;
}

function mediaMs() {
  return getSettings().mediaDays * 24 * 60 * 60 * 1000;
}
const timers = new Map<string, NodeJS.Timeout>();
const busy = new Set<string>();
let status: WaStatus = emptyStatus();
let openaiBlockedUntil = 0;
let generation = 0;

function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  let raw = "";
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function publish(patch: Partial<WaStatus>) {
  status = {
    ...status,
    ...patch,
    openai: hasOpenAiKey(),
    model: process.env.OPENAI_MODEL || "gpt-6.1-sol",
    updatedAt: Date.now(),
  };
  const target = statusPath();
  mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp`;
  writeFileSync(temp, JSON.stringify(status));
  writeFileSync(target, JSON.stringify(status));
}

function messageTime(message: WAMessage) {
  const raw = message.messageTimestamp as unknown;
  let seconds = 0;
  if (typeof raw === "number") seconds = raw;
  else if (raw && typeof raw === "object" && "toNumber" in raw && typeof raw.toNumber === "function") {
    seconds = raw.toNumber();
  } else if (raw != null) seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return Date.now();
  return seconds < 10_000_000_000 ? seconds * 1000 : seconds;
}

function storeChat(chat: Chat) {
  const jid = chat.id || "";
  if (!jid || isJidStatusBroadcast(jid) || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) return;
  const raw = chat.conversationTimestamp as unknown;
  let seconds = 0;
  if (typeof raw === "number") seconds = raw;
  else if (raw && typeof raw === "object" && "toNumber" in raw && typeof raw.toNumber === "function") seconds = raw.toNumber();
  else if (raw != null) seconds = Number(raw);
  const at = Number.isFinite(seconds) && seconds > 0 ? (seconds < 10_000_000_000 ? seconds * 1000 : seconds) : null;
  upsertChat({
    jid,
    name: chat.name || null,
    phone: phoneFromJid(jid),
    isGroup: Boolean(isJidGroup(jid)),
    lastMessageAt: at,
  });
}

function phoneFromJid(jid: string | null | undefined) {
  if (!jid) return null;
  const host = jid.includes("@") ? jid.split("@")[1] || "" : "s.whatsapp.net";
  if (host.includes("lid")) return null;
  const user = (jid.split("@")[0] || "").split(":")[0].replace(/\D/g, "");
  if (user.length < 8 || user.length > 15) return null;
  return `+${user}`;
}

async function resolvePhone(
  sock: ReturnType<typeof makeWASocket>,
  message: WAMessage,
  jid: string,
  senderJid: string | null,
) {
  const alt = phoneFromJid(message.key.participantAlt) || phoneFromJid(message.key.remoteJidAlt);
  if (alt) return alt;
  const direct = phoneFromJid(senderJid) || (!jid.endsWith("@g.us") ? phoneFromJid(jid) : null);
  if (direct) return direct;
  const lid = [senderJid, jid].find((value) => value?.includes("@lid"));
  if (!lid) return null;
  try {
    const mapped = await sock.signalRepository.lidMapping.getPNForLID(lid);
    return phoneFromJid(mapped);
  } catch (error) {
    console.error("Phone lookup failed", error);
    return null;
  }
}

function extension(mime: string | null | undefined, fallback: string) {
  const value = (mime || "").toLowerCase();
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg";
  if (value.includes("png")) return "png";
  if (value.includes("webp")) return "webp";
  if (value.includes("ogg")) return "ogg";
  if (value.includes("mpeg") || value.includes("mp3")) return "mp3";
  if (value.includes("mp4")) return "mp4";
  if (value.includes("pdf")) return "pdf";
  return fallback;
}

function fileName(messageId: string, ext: string) {
  return `${createHash("sha1").update(messageId).digest("hex").slice(0, 24)}.${ext}`;
}

function schedule(chatJid: string) {
  const existing = timers.get(chatJid);
  if (existing) clearTimeout(existing);
  timers.set(
    chatJid,
    setTimeout(() => {
      timers.delete(chatJid);
      void processChat(chatJid);
    }, 12000),
  );
}

async function processChat(chatJid: string) {
  if (busy.has(chatJid)) return;
  reloadSecrets();
  if (!getSettings().sortingEnabled) return;
  if (!hasOpenAiKey()) return;
  if (Date.now() < openaiBlockedUntil) return;
  const fresh = listUnprocessed(chatJid) as MessageRow[];
  if (!fresh.length) return;
  busy.add(chatJid);
  try {
    for (const message of fresh) {
      if (message.message_type === "audio" && message.media_file && (!message.body || message.body === "[Voice note]")) {
        try {
          const text = await transcribeVoice(message.media_file, message.media_mime);
          if (text) {
            updateMessageBody(message.id, text);
            message.body = text;
          }
        } catch (error) {
          console.error("Voice transcription failed", error);
        }
      }
    }
    const context = recentContext(chatJid);
    const items = await analyzeChat({
      messages: context,
      newIds: fresh.map((message) => message.id),
      cards: openCards(chatJid),
    });
    const sender = [...fresh].reverse().find((message) => !message.from_me) || fresh[fresh.length - 1];
    for (const item of items) {
      saveExtractedCard({
        chatJid,
        senderName: sender?.sender_name || null,
        senderPhone: sender?.sender_phone || null,
        messageIds: fresh.map((message) => message.id),
        item,
      });
    }
    markProcessed(fresh.map((message) => message.id));
    publish({ lastError: null });
    if (items.length) {
      console.log(`Sorted ${items.length} card(s) from ${sender?.sender_name || chatJid}`);
    }
    if ((listUnprocessed(chatJid) as MessageRow[]).length) schedule(chatJid);
  } catch (error) {
    const statusCode =
      error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    if (statusCode === 401 || statusCode === 403) {
      openaiBlockedUntil = Date.now() + 5 * 60 * 1000;
      publish({ lastError: "OpenAI rejected the API key. Check OPENAI_API_KEY in .env and restart." });
    } else {
      publish({ lastError: error instanceof Error ? error.message : "Sorting failed" });
      console.error("Sorting failed", error);
    }
  } finally {
    busy.delete(chatJid);
  }
}

async function ingest(message: WAMessage, source: "live" | "history", sock: ReturnType<typeof makeWASocket>) {
  const jid = message.key.remoteJid;
  if (!jid || isJidStatusBroadcast(jid) || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) return;
  const content = normalizeMessageContent(message.message);
  if (!content) return;
  const type = getContentType(content);
  if (!type || type === "protocolMessage" || type === "reactionMessage" || type === "senderKeyDistributionMessage") {
    return;
  }

  const at = messageTime(message);
  if (source === "history" && at < Date.now() - keepMs()) return;

  const fromMe = Boolean(message.key.fromMe);
  const group = Boolean(isJidGroup(jid));
  const senderJid = message.key.participant || (group ? null : jid);
  const senderPhone = await resolvePhone(sock, message, jid, senderJid);
  const senderName = message.pushName || (senderJid ? contactName(senderJid) : null) || null;
  const id = `${jid}:${message.key.id || createHash("sha1").update(JSON.stringify(message.key)).digest("hex")}`;

  let body = "";
  let messageType = "text";
  let mediaFile: string | null = null;
  let mediaMime: string | null = null;
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (type === "conversation") body = content.conversation || "";
  else if (type === "extendedTextMessage") body = content.extendedTextMessage?.text || "";
  else if (type === "imageMessage") {
    messageType = "image";
    body = content.imageMessage?.caption || "[Photo]";
    mediaMime = content.imageMessage?.mimetype || "image/jpeg";
  } else if (type === "videoMessage") {
    messageType = "video";
    body = content.videoMessage?.caption || "[Video]";
    mediaMime = content.videoMessage?.mimetype || "video/mp4";
  } else if (type === "audioMessage") {
    messageType = "audio";
    body = "[Voice note]";
    mediaMime = content.audioMessage?.mimetype || "audio/ogg";
  } else if (type === "documentMessage" || type === "documentWithCaptionMessage") {
    messageType = "document";
    const document =
      content.documentMessage || content.documentWithCaptionMessage?.message?.documentMessage;
    const fileLabel = document?.fileName || "";
    body = document?.caption || fileLabel || "[Document]";
    mediaMime =
      document?.mimetype || (fileLabel.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    if (mediaMime.startsWith("image/")) messageType = "image";
  } else if (type === "locationMessage" || type === "liveLocationMessage") {
    messageType = "location";
    const location = content.locationMessage || content.liveLocationMessage;
    const named = content.locationMessage;
    latitude = location?.degreesLatitude ?? null;
    longitude = location?.degreesLongitude ?? null;
    body = `Location: ${latitude ?? ""}, ${longitude ?? ""} ${named?.name || named?.address || ""}`.trim();
  } else if (type === "stickerMessage") {
    messageType = "image";
    body = "[Sticker]";
    mediaMime = content.stickerMessage?.mimetype || "image/webp";
  } else if (type === "contactMessage") {
    body = content.contactMessage?.displayName || "[Contact]";
  } else {
    return;
  }

  const age = Date.now() - at;
  const shouldDownload =
    (messageType === "image" || messageType === "audio" || messageType === "document" || messageType === "video") &&
    (source === "live" || (messageType !== "video" && age <= mediaMs()) || (messageType === "video" && age <= analyzeMs()));

  if (shouldDownload) {
    try {
      const buffer = (await downloadMediaMessage(message, "buffer", {}, {
        logger,
        reuploadRequest: (current) => sock.updateMediaMessage(current),
      })) as Buffer;
      const fallback = messageType === "audio" ? "ogg" : messageType === "document" ? "pdf" : "jpg";
      const name = fileName(id, extension(mediaMime, fallback));
      writeFileSync(path.join(mediaDir(), name), buffer);
      mediaFile = name;
      if (name.endsWith(".pdf") || (mediaMime || "").includes("pdf")) {
        try {
          const text = await pdfText(buffer);
          if (text) body = `${body}\n\n${text}`.slice(0, 100000);
          await savePdfImages(buffer, name);
        } catch (error) {
          console.error("PDF text extraction failed", error);
        }
      }
    } catch (error) {
      console.error("Media download failed", error);
    }
  }

  const analyze = !fromMe && (source === "live" || at >= Date.now() - analyzeMs());
  const inserted = insertMessage({
    id,
    chat_jid: jid,
    sender_name: senderName,
    sender_phone: senderPhone,
    from_me: fromMe ? 1 : 0,
    body,
    message_type: messageType,
    media_file: mediaFile,
    media_mime: mediaMime,
    latitude,
    longitude,
    timestamp: at,
    processed: analyze ? 0 : 1,
  });

  const preview = body.replace(/\s+/g, " ").slice(0, 140);
  upsertChat({
    jid,
    name: group ? null : senderName,
    phone: group ? null : senderPhone,
    isGroup: group,
    lastMessageAt: at,
    lastPreview: preview,
  });

  if (!group && senderPhone) rememberPhone(jid, senderPhone);
  if (group) void rememberGroup(sock, jid);
  if (avatarsOpen) void rememberAvatar(sock, jid);
  if (inserted && analyze) schedule(jid);
}

const pictured = new Set<string>();
let avatarsOpen = false;

async function rememberAvatar(sock: ReturnType<typeof makeWASocket>, jid: string) {
  if (!jid || pictured.has(jid) || jid.endsWith("@broadcast") || jid.endsWith("@newsletter")) return;
  pictured.add(jid);
  try {
    const url = await sock.profilePictureUrl(jid, "image");
    if (!url) return;
    const response = await fetch(url);
    if (!response.ok) return;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 80) return;
    const name = `avatar-${createHash("sha1").update(jid).digest("hex").slice(0, 20)}.jpg`;
    writeFileSync(path.join(mediaDir(), name), bytes);
    setChatAvatar(jid, name);
    console.log("Saved a profile photo");
  } catch {
    // WhatsApp hid this photo, or the chat has none.
  }
}

async function fillAvatars(sock: ReturnType<typeof makeWASocket>) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  for (const chat of chatsMissingAvatars()) {
    await rememberAvatar(sock, chat.jid);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  avatarsOpen = true;
}

const namedGroups = new Set<string>();

async function rememberGroup(sock: ReturnType<typeof makeWASocket>, jid: string) {
  if (namedGroups.has(jid)) return;
  namedGroups.add(jid);
  try {
    const meta = await sock.groupMetadata(jid);
    if (meta.subject) upsertChat({ jid, name: meta.subject, isGroup: true });
  } catch (error) {
    namedGroups.delete(jid);
    console.error("Group name lookup failed", error);
  }
}

async function fillRealPhones(sock: ReturnType<typeof makeWASocket>) {
  clearLidPhones();
  for (const chat of listPrivateLids()) {
    try {
      const mapped = await sock.signalRepository.lidMapping.getPNForLID(chat.jid);
      const phone = phoneFromJid(mapped);
      if (phone) {
        rememberPhone(chat.jid, phone);
        console.log(`Saved real number for ${chat.jid}`);
      }
    } catch (error) {
      console.error("Phone lookup failed", error);
    }
  }
}

async function connect() {
  const gen = ++generation;
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir());
  let version: [number, number, number] | undefined;
  try {
    version = (await fetchLatestWaWebVersion()).version;
  } catch (error) {
    console.warn("Using the built-in WhatsApp version", error);
  }

  const sock = makeWASocket({
    auth: state,
    logger,
    version,
    browser: Browsers.windows("Chrome"),
    markOnlineOnConnect: false,
    syncFullHistory: true,
    shouldSyncHistoryMessage: () => true,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("contacts.upsert", (contacts) => {
    for (const contact of contacts) {
      if (!contact.id) continue;
      upsertContact(contact.id, contact.name || contact.notify || null, phoneFromJid(contact.phoneNumber));
      const real = phoneFromJid(contact.phoneNumber);
      if (real && contact.id) rememberPhone(contact.id, real);
    }
  });
  sock.ev.on("chats.upsert", (chats) => {
    for (const chat of chats) storeChat(chat);
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (gen !== generation) return;
    for (const message of messages) {
      await ingest(message, type === "notify" ? "live" : "history", sock);
    }
  });
  sock.ev.on("messaging-history.set", async ({ chats, messages }) => {
    if (gen !== generation) return;
    for (const chat of chats || []) storeChat(chat);
    const recent = messages
      .filter((message) => messageTime(message) >= Date.now() - keepMs())
      .sort((a, b) => messageTime(a) - messageTime(b))
      .slice(-5000);
    for (const message of recent) await ingest(message, "history", sock);
  });
  sock.ev.on("connection.update", (update) => {
    if (gen !== generation && update.connection !== "close") return;
    if (update.qr) {
      const ticket = generation;
      void QRCode.toDataURL(update.qr).then((qrDataUrl) => {
        if (ticket !== generation || status.state === "connected") return;
        publish({ state: "qr", qrDataUrl, phone: null, lastError: null });
      });
    }
    if (update.connection === "open") {
      const raw = sock.user?.id || "";
      publish({
        state: "connected",
        qrDataUrl: null,
        phone: phoneFromJid(raw),
        lastError: null,
      });
      console.log("WhatsApp connected");
      liveSock = sock;
      void fillRealPhones(sock);
      for (const group of listUnnamedGroups()) void rememberGroup(sock, group.jid);
      void fillAvatars(sock);
    }
    if (update.connection === "close") {
      if (gen !== generation) return;
      liveSock = null;
      const code = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
        ?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      generation += 1;
      publish({
        state: "reconnecting",
        qrDataUrl: null,
        lastError: loggedOut ? "WhatsApp link was removed. A new code will appear." : null,
      });
      if (loggedOut) rmSync(sessionDir(), { recursive: true, force: true });
      setTimeout(() => void connect(), loggedOut ? 1500 : 3000);
    }
  });
}

function outgoingPayload(item: { body: string; media_file: string | null; media_mime: string | null }) {
  if (!item.media_file) return { text: item.body };
  const buffer = readFileSync(path.join(mediaDir(), path.basename(item.media_file)));
  const mime = item.media_mime || "application/octet-stream";
  const caption = item.body || undefined;
  if (mime.startsWith("image/")) return { image: buffer, caption };
  if (mime.startsWith("video/")) return { video: buffer, caption };
  return { document: buffer, mimetype: mime, fileName: path.basename(item.media_file), caption };
}

async function flushReplies() {
  if (!liveSock || status.state !== "connected") return;
  for (const item of claimReplies()) {
    try {
      const sent = await liveSock.sendMessage(item.chat_jid, await outgoingPayload(item));
      const messageId = sent?.key.id;
      const preview = item.body || (item.media_file ? "Attachment" : "");
      const kind = item.media_mime?.startsWith("image/")
        ? "image"
        : item.media_mime?.startsWith("video/")
          ? "video"
          : item.media_file
            ? "document"
            : "text";
      if (messageId) {
        insertMessage({
          id: `${item.chat_jid}:${messageId}`,
          chat_jid: item.chat_jid,
          sender_name: null,
          sender_phone: null,
          from_me: 1,
          body: preview,
          message_type: kind,
          media_file: item.media_file,
          media_mime: item.media_mime,
          latitude: null,
          longitude: null,
          timestamp: Date.now(),
          processed: 1,
        });
      }
      upsertChat({
        jid: item.chat_jid,
        isGroup: item.chat_jid.endsWith("@g.us"),
        lastMessageAt: Date.now(),
        lastPreview: preview.replace(/\s+/g, " ").slice(0, 140),
      });
      finishReply(item.id, "sent", null);
    } catch (error) {
      finishReply(item.id, "failed", error instanceof Error ? error.message : "Send failed");
      console.error("WhatsApp send failed", error);
    }
  }
}

function sweep() {
  reloadSecrets();
  if (!getSettings().sortingEnabled || !hasOpenAiKey() || Date.now() < openaiBlockedUntil) return;
  const chats = listUnprocessed() as { chat_jid: string }[];
  for (const chat of chats) {
    if (!timers.has(chat.chat_jid) && !busy.has(chat.chat_jid)) schedule(chat.chat_jid);
  }
}

publish({ state: "reconnecting", qrDataUrl: null, lastError: null });
console.log("Newton Property WhatsApp worker is running");
console.log("Open http://localhost:3000");
if (!hasOpenAiKey()) {
  console.log("Add OPENAI_API_KEY to .env and restart. Messages will be saved, then sorted.");
}
const logoutFile = path.join(process.cwd(), "data", "wa-logout");

async function takeLogout() {
  if (!existsSync(logoutFile)) return;
  rmSync(logoutFile, { force: true });
  console.log("Disconnecting WhatsApp");
  if (liveSock) {
    try {
      await liveSock.logout();
      return;
    } catch (error) {
      console.error("WhatsApp logout failed", error);
    }
  }
  generation += 1;
  liveSock = null;
  rmSync(sessionDir(), { recursive: true, force: true });
  publish({
    state: "reconnecting",
    qrDataUrl: null,
    phone: null,
    lastError: "Scan the new code to link a different number.",
  });
  setTimeout(() => void connect(), 500);
}

setInterval(() => void takeLogout(), 1000);
setInterval(() => publish({}), 5000);
setInterval(sweep, 45000);
setInterval(() => void flushReplies(), 2500);
void connect();
