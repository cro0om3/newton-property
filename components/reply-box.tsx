"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";

export function ReplyBox({ chatJid, cardId, compact = false }: { chatJid: string | null; cardId?: string; compact?: boolean }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!chatJid || chatJid === "desk") {
    return <p className="text-sm text-muted">This record is not linked to a WhatsApp chat.</p>;
  }

  async function draft() {
    setBusy(true);
    setNote("");
    const path = cardId ? `/api/cards/${cardId}/draft` : `/api/chats/${encodeURIComponent(chatJid!)}/reply`;
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: cardId ? undefined : JSON.stringify({ action: "draft" }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setNote("Could not draft a reply.");
      return;
    }
    setText(body.text || "");
    setNote(body.source === "openai" ? "Draft from the assistant. Edit it, then send." : "Draft from the saved details. Edit it, then send.");
  }

  async function send() {
    if (!text.trim() && !file) return;
    setBusy(true);
    const response = file
      ? await fetch(`/api/chats/${encodeURIComponent(chatJid!)}/media`, {
          method: "POST",
          body: (() => {
            const form = new FormData();
            form.set("file", file);
            form.set("caption", text);
            return form;
          })(),
        })
      : await fetch(`/api/chats/${encodeURIComponent(chatJid!)}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send", body: text }),
        });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setNote(body.error || "Could not queue the reply. Check that this chat is still open.");
      return;
    }
    setText("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setNote("Queued. It goes out from your linked WhatsApp number.");
  }

  if (compact) {
    return (
      <div className="space-y-1.5">
        {file ? <p className="truncate px-2 text-xs text-muted">{file.name}</p> : null}
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,.pdf,application/pdf"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label="Attach" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-paper">
            <Icon name="clip" className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 flex-1 items-end rounded-3xl bg-paper px-3">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={1}
              placeholder="Message"
              className="max-h-28 min-h-11 w-full resize-none bg-transparent py-3 text-sm leading-5 outline-none"
            />
            <button type="button" onClick={() => void draft()} disabled={busy} aria-label="Draft reply" className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-sand">
              <Icon name="chat" className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || (!text.trim() && !file)}
            aria-label="Send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-pine text-white disabled:opacity-40"
          >
            <Icon name="send" className="h-4 w-4" />
          </button>
        </div>
        {note ? <p className="px-2 text-xs text-muted">{note}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        placeholder="Write a reply"
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,.pdf,application/pdf"
          className="hidden"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-medium">
          <Icon name="clip" className="h-4 w-4" />
          {file ? file.name : "Attach"}
        </button>
        <button type="button" onClick={() => void draft()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-panel px-3 py-2 text-sm font-medium">
          <Icon name="chat" className="h-4 w-4" />
          Draft reply
        </button>
        <button type="button" onClick={() => void send()} disabled={busy || (!text.trim() && !file)} className="inline-flex items-center gap-1.5 rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white">
          <Icon name="send" className="h-4 w-4" />
          Send
        </button>
      </div>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </div>
  );
}
