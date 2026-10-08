"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Attachment } from "@/components/attachment";
import { Icon } from "@/components/icons";
import { ReplyBox } from "@/components/reply-box";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { deskZone, formatPhone } from "@/lib/format";
import type { ChatRow, MessageRow } from "@/lib/types";

function dayKey(timestamp: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: deskZone(),
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
  return new Intl.DateTimeFormat("en-GB", { timeZone: deskZone(), day: "2-digit", month: "short" }).format(new Date(timestamp));
}

function bubbleTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: deskZone(), hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
}

function clock(timestamp: number | null) {
  if (!timestamp) return "";
  const key = dayKey(timestamp);
  if (key === dayKey(Date.now())) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: deskZone(), hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
  }
  return dayLabel(timestamp);
}

function chatTitle(chat: ChatRow) {
  if (chat.name) return chat.name;
  const phone = formatPhone(chat.phone);
  return phone === "—" ? "Unnamed chat" : phone;
}

function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((part) => part[0] || "").join("");
  return letters.toUpperCase() || "?";
}

function Avatar({ label, group = false, file }: { label: string; group?: boolean; file?: string | null }) {
  if (file) {
    return <img src={`/api/media/${file}`} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand text-xs font-semibold text-pine">
      {group ? <Icon name="layers" className="h-4 w-4" /> : initials(label)}
    </span>
  );
}

function visibleText(message: MessageRow) {
  const body = message.body || "";
  if (message.message_type === "image" && (body === "[Photo]" || body === "[Sticker]" || !body.trim())) return "";
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
  const [developer, setDeveloper] = useState("");
  const [newDeveloper, setNewDeveloper] = useState("");
  const [developers, setDevelopers] = useState<string[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch("/api/chats");
      if (!response.ok || stop) return;
      const body = await response.json();
      setChats(body.chats);
      setDevelopers(body.developers || []);
      const wanted = new URLSearchParams(window.location.search).get("chat");
      setActive((current) => current || wanted || body.chats[0]?.jid || null);
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
    setDeveloper(current?.company_name || "");
  }, [current?.jid, current?.name, current?.company_name]);

  const teammates = chats.filter((chat) => current?.company_name && chat.company_name === current.company_name && chat.jid !== current.jid && !chat.is_group);

  async function savePerson() {
    if (!active || !draft.trim()) return;
    await fetch(`/api/chats/${encodeURIComponent(active)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft.trim(), developer: (developer === "__new__" ? newDeveloper : developer).trim() }),
    });
    const response = await fetch("/api/chats");
    if (response.ok) {
      const body = await response.json();
      setChats(body.chats);
      setDevelopers(body.developers || []);
    }
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
    <div className="grid h-full min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] overflow-hidden">
      <aside className="flex min-h-0 flex-col border-r border-line bg-panel">
        <div className="shrink-0 px-4 py-4">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Icon name="chat" className="h-5 w-5 text-pine" />
            WhatsApp
          </h1>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2">
            <Icon name="search" className="h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.map((chat) => (
            <button
              key={chat.jid}
              onClick={() => setActive(chat.jid)}
              className={`flex w-full items-center gap-3 border-t border-line px-4 py-3 text-left ${chat.jid === active ? "bg-sand" : "hover:bg-paper"}`}
            >
              <Avatar label={chatTitle(chat)} group={Boolean(chat.is_group)} file={chat.avatar} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{chatTitle(chat)}</span>
                  <span className="shrink-0 text-[11px] text-muted">{clock(chat.last_message_at)}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">{chat.last_preview || "No text"}</span>
                {chat.company_name || chat.listings ? (
                  <span className="mt-1 flex items-center gap-2 text-[11px] font-medium text-leaf">
                    {chat.company_name ? <span className="inline-flex items-center gap-1"><Icon name="building" className="h-3 w-3" />{chat.company_name}</span> : null}
                    {chat.listings ? <span>{chat.listings} saved</span> : null}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
          {filtered.length === 0 ? <p className="px-4 text-sm text-muted">No chats match.</p> : null}
        </div>
      </aside>
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#e6edf5]">
        <header className="shrink-0 border-b border-line bg-panel px-4 py-2.5">
          {current ? (
            <div className="flex flex-wrap items-center gap-2">
              <Avatar label={chatTitle(current)} group={Boolean(current.is_group)} file={current.avatar} />
              <div className="min-w-0 pr-1">
                <p className="truncate text-sm font-semibold">{chatTitle(current)}</p>
                <p className="flex items-center gap-1 truncate text-[11px] text-muted">
                  {current.is_group ? (
                    <Icon name="layers" className="h-3.5 w-3.5" />
                  ) : current.company_logo ? (
                    <img src={`/api/media/${current.company_logo}`} alt="" className="h-3.5 w-3.5 rounded object-cover" />
                  ) : (
                    <Icon name="building" className="h-3.5 w-3.5" />
                  )}
                  {current.is_group ? "Group" : current.company_name || "No developer yet"}
                </p>
              </div>
              {shownPhone === "—" ? null : <WhatsAppLink phone={shownPhone} />}
              <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />
              <label className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-paper px-2.5">
                <Icon name="user" className="h-3.5 w-3.5 text-pine" />
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Name"
                  aria-label="Employee name"
                  className="w-24 bg-transparent text-sm outline-none"
                />
              </label>
              <label className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-paper px-2.5">
                <Icon name="building" className="h-3.5 w-3.5 text-pine" />
                <select
                  value={developers.includes(developer) || developer === "" || developer === "__new__" ? developer : ""}
                  onChange={(event) => setDeveloper(event.target.value)}
                  aria-label="Developer"
                  className="w-32 bg-transparent text-sm outline-none"
                >
                  <option value="">No developer</option>
                  {developers.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                  <option value="__new__">New developer...</option>
                </select>
              </label>
              {developer === "__new__" ? (
                <input
                  value={newDeveloper}
                  onChange={(event) => setNewDeveloper(event.target.value)}
                  placeholder="Developer name"
                  className="h-9 w-36 rounded-full border border-line bg-paper px-3 text-sm"
                />
              ) : null}
              <button type="button" onClick={() => void savePerson()} title="Save" aria-label="Save" className="grid h-9 w-9 place-items-center rounded-full bg-pine text-white">
                <Icon name="check" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                title="Remove chat"
                aria-label="Remove chat"
                onClick={() => {
                  if (!active || !window.confirm("Remove this chat from the desk? It can come back if they message again.")) return;
                  void fetch(`/api/chats/${encodeURIComponent(active)}`, { method: "DELETE" }).then((response) => {
                    if (!response.ok) return;
                    setChats((current) => current.filter((chat) => chat.jid !== active));
                    setActive(null);
                  });
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-line bg-panel text-clay"
              >
                <Icon name="trash" className="h-3.5 w-3.5" />
              </button>
              {teammates.map((person) => (
                <button
                  key={person.jid}
                  type="button"
                  onClick={() => setActive(person.jid)}
                  title="Same developer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand px-2.5 text-xs font-medium text-pine"
                >
                  <Icon name="user" className="h-3.5 w-3.5" />
                  {chatTitle(person)}
                </button>
              ))}
            </div>
          ) : (
            <h2 className="flex items-center gap-2 font-semibold">
              <Icon name="chat" className="h-4 w-4 text-pine" />
              Select a chat
            </h2>
          )}
        </header>
        <div ref={threadRef} className="chat-thread min-h-0 min-w-0 flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-4 py-3">
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const showDay = !previous || dayKey(previous.timestamp) !== dayKey(message.timestamp);
            const text = visibleText(message);
            const mine = Boolean(message.from_me);
            const sender = !mine && current?.is_group ? message.sender_name : "";
            return (
              <div key={message.id}>
                {showDay ? (
                  <p className="mx-auto my-2 w-fit rounded-lg bg-white/90 px-2.5 py-0.5 text-[11px] text-muted shadow-sm">{dayLabel(message.timestamp)}</p>
                ) : null}
                <article className={`group flex min-w-0 max-w-full ${mine ? "justify-end" : "justify-start"}`}>
                  <div className="relative w-fit max-w-full min-w-0">
                    <div
                      className={`w-fit max-w-full min-w-0 shadow-[0_1px_1px_rgba(7,24,51,0.08)] ${
                        mine ? "rounded-2xl rounded-br-md bg-pine text-white" : "rounded-2xl rounded-bl-md bg-white text-ink"
                      } ${message.media_file && !text ? "p-1" : "px-1.5 pt-1 pb-1"}`}
                    >
                      {sender ? <p className="px-1.5 pt-0.5 text-[12px] font-semibold text-leaf">{sender}</p> : null}
                      {message.media_file ? (
                        <div className="max-w-60">
                          <Attachment message={message} fit light={mine} />
                        </div>
                      ) : null}
                      {message.latitude != null && message.longitude != null ? (
                        <a
                          href={`https://maps.google.com/?q=${message.latitude},${message.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-0.5 inline-flex items-center gap-1 px-1.5 text-xs font-medium ${mine ? "text-white" : "text-leaf"}`}
                        >
                          <Icon name="pin" className="h-3.5 w-3.5" />
                          Open map
                        </a>
                      ) : null}
                      <div className={`flex max-w-full items-end gap-2 ${text ? "px-1" : "justify-end px-1.5 pb-0.5"}`}>
                        {text ? (
                          <p dir="auto" className="min-w-0 max-w-[min(18rem,100%)] whitespace-pre-wrap break-words text-[14.5px] leading-5">
                            {text}
                          </p>
                        ) : null}
                        <span className={`shrink-0 pb-0.5 text-[10px] leading-none ${mine ? "text-white/70" : "text-muted"}`}>
                          {bubbleTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                    {!mine ? (
                      <div className="absolute top-1 right-1 z-10 hidden gap-1 group-hover:flex">
                        <button
                          type="button"
                          title="Save as property"
                          onClick={() => void saveFromMessage(message, "listing")}
                          className="grid h-7 w-7 place-items-center rounded-full bg-white text-pine shadow-sm"
                        >
                          <Icon name="building" className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Save as client"
                          onClick={() => void saveFromMessage(message, "inquiry")}
                          className="grid h-7 w-7 place-items-center rounded-full bg-white text-pine shadow-sm"
                        >
                          <Icon name="user" className="h-3.5 w-3.5" />
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
          <footer className="shrink-0 bg-[#e6edf5] px-3 py-2">
            <ReplyBox chatJid={active} compact />
          </footer>
        ) : null}
      </section>
    </div>
  );
}
