"use client";

import { useRef, useState } from "react";

export function ReplyBox({ chatJid, cardId }: { chatJid: string | null; cardId?: string }) {
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
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-xl border border-line bg-panel px-3 py-2 text-sm font-medium">
          {file ? file.name : "Attach"}
        </button>
        <button type="button" onClick={() => void draft()} disabled={busy} className="rounded-xl border border-line bg-panel px-3 py-2 text-sm font-medium">
          Draft reply
        </button>
        <button type="button" onClick={() => void send()} disabled={busy || (!text.trim() && !file)} className="rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white">
          Send on WhatsApp
        </button>
      </div>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </div>
  );
}
