"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Attachment } from "@/components/attachment";
import { ReplyBox } from "@/components/reply-box";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { formatPhone, formatWhen } from "@/lib/format";
import type { ChatRow, MessageRow } from "@/lib/types";

function dayKey(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function dayLabel(timestamp: number) {
  const key = dayKey(timestamp);
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 24 * 60 * 60 * 1000);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short" }).format(new Date(timestamp));
}

function clock(timestamp: number | null) {
  if (!timestamp) return "";
  const key = dayKey(timestamp);
  if (key === dayKey(Date.now())) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
  }
  return dayLabel(timestamp);
}

function chatTitle(chat: ChatRow) {
  if (chat.name) return chat.name;
  const phone = formatPhone(chat.phone);
  return phone === "—" ? "Unnamed chat" : phone;
}

function visibleText(message: MessageRow) {
  const body = message.body || "";
  if (message.message_type === "image" && (body === "[Photo]" || !body.trim())) return "";
  if (message.message_type === "video" && (body === "[Video]" || !body.trim())) return "";
  if (message.message_type === "audio" && body === "[Voice note]") return "";
  if (message.message_type === "document" && body.length > 180) return body.split("\n")[0] || "";
  return body;
}

export default function InboxPage() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch("/api/chats");
      if (!response.ok || stop) return;
      const body = await response.json();
      setChats(body.chats);
      setActive((current) => current || body.chats[0]?.jid || null);
    }
    void load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let stop = false;
    async function load() {
      const response = await fetch(`/api/chats/${encodeURIComponent(active!)}`);
      if (!response.ok || stop) return;
      const body = await response.json();
      setMessages(body.messages);
    }
    void load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [active]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return chats;
    return chats.filter((chat) =>
      [chat.name, chat.phone, chat.last_preview, chat.company_name].some((value) => (value || "").toLowerCase().includes(needle)),
    );
  }, [chats, query]);

  const current = chats.find((chat) => chat.jid === active);
  const shownPhone = formatPhone(current?.phone);

  useEffect(() => {
    setDraft(current?.name || "");
  }, [current?.jid, current?.name]);

  async function saveName() {
    if (!active || !draft.trim()) return;
    await fetch(`/api/chats/${encodeURIComponent(active)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.trim() }),
    });
    const response = await fetch("/api/chats");
    if (response.ok) setChats((await response.json()).chats);
  }

  async function saveFromMessage(message: MessageRow, kind: "listing" | "inquiry") {
    const text = (message.body || "").replace(/\s+/g, " ").trim();
    const title = text.slice(0, 80) || (kind === "listing" ? "Listing from WhatsApp" : "Client from WhatsApp");
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        title,
        summary: (message.body || "").slice(0, 4000),
        senderName: message.sender_name || current?.name || "",
        senderPhone: message.sender_phone || current?.phone || "",
        chatJid: active,
        messageId: message.id,
        purpose: kind === "listing" ? "sale" : "buy",
      }),
    });
    if (!response.ok) return;
    const body = await response.json();
    router.push(kind === "listing" ? `/properties/${body.id}` : `/clients/${body.id}`);
  }

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [active, messages.length]);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] overflow-hidden">
      <aside className="flex min-h-0 flex-col border-r border-line bg-panel">
        <div className="shrink-0 px-4 py-4">
          <h1 className="text-lg font-semibold">WhatsApp</h1>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search chats"
            className="mt-3 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((chat) => (
            <button
              key={chat.jid}
              onClick={() => setActive(chat.jid)}
              className={`block w-full border-t border-line px-4 py-3 text-left ${chat.jid === active ? "bg-sand" : "hover:bg-paper"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{chatTitle(chat)}</p>
                <span className="shrink-0 text-[11px] text-muted">{clock(chat.last_message_at)}</span>
              </div>
              <p className="truncate text-xs text-muted">{chat.last_preview || "No text"}</p>
              {chat.listings ? <p className="mt-1 text-[11px] font-medium text-leaf">{chat.listings} saved</p> : null}
            </button>
          ))}
          {filtered.length === 0 ? <p className="px-4 text-sm text-muted">No chats match.</p> : null}
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-paper">
        <header className="shrink-0 border-b border-line bg-panel px-5 py-3">
          {current ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{chatTitle(current)}</p>
                <p className="truncate text-xs text-muted">
                  {current.is_group ? "Group" : current.company_name || "No company yet"}
                  {current.listings ? ` · ${current.listings} listing${current.listings === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Name"
                  className="w-40 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
                />
                <button type="button" onClick={() => void saveName()} className="rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white">
                  Save name
                </button>
                {shownPhone === "—" ? null : <WhatsAppLink phone={shownPhone} />}
              </div>
            </div>
          ) : (
            <h2 className="font-semibold">Select a chat</h2>
          )}
        </header>
        <div ref={threadRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const showDay = !previous || dayKey(previous.timestamp) !== dayKey(message.timestamp);
            const text = visibleText(message);
            return (
              <div key={message.id}>
                {showDay ? (
                  <p className="mx-auto my-3 w-fit rounded-full bg-panel px-3 py-1 text-[11px] text-muted">{dayLabel(message.timestamp)}</p>
                ) : null}
                <article className={`flex ${message.from_me ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[min(36rem,85%)] rounded-2xl px-3 py-2 ${message.from_me ? "bg-pine text-white" : "border border-line bg-panel"}`}>
                    {!message.from_me && current?.is_group ? (
                      <p className="text-xs font-medium text-leaf">{message.sender_name || "Member"}</p>
                    ) : null}
                    <Attachment message={message} large />
                    {text ? (
                      <p dir="auto" className="mt-1 whitespace-pre-wrap text-sm leading-6">
                        {text}
                      </p>
                    ) : null}
                    <p className={`mt-1 text-[11px] ${message.from_me ? "text-white/70" : "text-muted"}`}>{formatWhen(message.timestamp)}</p>
                    {!message.from_me ? (
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => void saveFromMessage(message, "listing")} className="text-[11px] font-medium text-leaf">
                          Save as property
                        </button>
                        <button type="button" onClick={() => void saveFromMessage(message, "inquiry")} className="text-[11px] font-medium text-leaf">
                          Save as client
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              </div>
            );
          })}
        </div>
        {active ? (
          <footer className="shrink-0 border-t border-line bg-panel px-4 py-3">
            <ReplyBox chatJid={active} />
          </footer>
        ) : null}
      </section>
    </div>
  );
}
