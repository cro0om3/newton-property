"use client";

import { useState } from "react";
import type { MessageRow } from "@/lib/types";

export function Attachment({
  message,
  large = false,
}: {
  message: Pick<MessageRow, "message_type" | "media_file" | "media_mime" | "body">;
  large?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!message.media_file) return null;
  const src = `/api/media/${message.media_file}`;
  const pdf = message.message_type === "document" || message.media_file.endsWith(".pdf") || (message.media_mime || "").includes("pdf");
  const label = (message.body || "").split("\n")[0]?.replace(/^\[(Photo|Document|Video)\]$/, "").trim() || message.media_file;

  if (message.message_type === "image") {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className="mt-1 block">
          <img
            src={src}
            alt=""
            className={large ? "max-h-80 max-w-full rounded-xl object-contain" : "h-20 w-16 rounded-xl border border-line object-cover object-top"}
          />
        </button>
        {open ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-pine/80 p-4" onClick={() => setOpen(false)}>
            <img src={src} alt="" className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain" />
          </div>
        ) : null}
      </>
    );
  }
  if (message.message_type === "audio") {
    return <audio controls src={src} className="mt-2 w-full" />;
  }
  if (message.message_type === "video") {
    return <video controls src={src} className={large ? "mt-1 max-h-80 max-w-full rounded-xl" : "mt-2 max-h-64 rounded-xl"} />;
  }
  if (!pdf && message.message_type !== "document") return null;

  return (
    <a href={src} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-3 rounded-xl bg-sand px-3 py-2 text-pine">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-panel text-xs font-semibold">PDF</span>
      <span className="min-w-0 truncate text-sm font-medium">{label}</span>
    </a>
  );
}
