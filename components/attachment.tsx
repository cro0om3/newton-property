"use client";

import { useRef, useState } from "react";
import type { MessageRow } from "@/lib/types";

const BARS = [30, 55, 80, 40, 70, 100, 50, 85, 35, 65, 90, 45, 75, 30, 60, 95, 40, 70, 50, 80, 35, 60];

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function VoiceNote({ src, light = false }: { src: string; light?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [label, setLabel] = useState("0:00");

  function toggle() {
    const node = audio.current;
    if (!node) return;
    if (node.paused) void node.play();
    else node.pause();
  }

  return (
    <div className={`flex w-[min(15rem,100%)] max-w-full items-center gap-2 px-1 py-1 ${light ? "text-white" : "text-pine"}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${light ? "bg-white text-pine" : "bg-pine text-white"}`}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M8 5.5v13l11-6.5-11-6.5z" />
          </svg>
        )}
      </button>
      <span className="flex h-7 flex-1 items-center gap-px" aria-hidden="true">
        {BARS.map((height, index) => (
          <span key={index} className="w-[3px] rounded-full bg-current opacity-55" style={{ height: `${height}%` }} />
        ))}
      </span>
      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums opacity-70">{label}</span>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setLabel(clock(event.currentTarget.duration))}
        onTimeUpdate={(event) => {
          const node = event.currentTarget;
          setLabel(clock(node.paused ? node.duration : node.currentTime));
        }}
      />
    </div>
  );
}

export function Attachment({
  message,
  large = false,
  fit = false,
  light = false,
}: {
  message: Pick<MessageRow, "message_type" | "media_file" | "media_mime" | "body">;
  large?: boolean;
  fit?: boolean;
  light?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!message.media_file) return null;
  const src = `/api/media/${message.media_file}`;
  const pdf = message.message_type === "document" || message.media_file.endsWith(".pdf") || (message.media_mime || "").includes("pdf");
  const label = (message.body || "").split("\n")[0]?.replace(/^\[(Photo|Document|Video|Sticker)\]$/, "").trim() || "File";

  if (message.message_type === "image") {
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} className="block max-w-full">
          <img
            src={src}
            alt=""
            className={
              fit
                ? "max-h-64 w-auto max-w-full rounded-lg object-cover"
                : large
                  ? "max-h-80 max-w-full rounded-xl object-contain"
                  : "h-20 w-16 rounded-xl border border-line object-cover object-top"
            }
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
    if (fit) return <VoiceNote src={src} light={light} />;
    return <audio controls src={src} className="mt-2 max-w-full" />;
  }
  if (message.message_type === "video") {
    return <video controls src={src} className={fit ? "max-h-64 w-full max-w-full rounded-lg" : large ? "mt-1 max-h-80 max-w-full rounded-xl" : "mt-2 max-h-64 max-w-full rounded-xl"} />;
  }
  if (!pdf && message.message_type !== "document") return null;

  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className={`flex max-w-full items-center gap-2 rounded-lg px-2 py-1.5 ${fit ? "w-[min(14rem,100%)]" : "mt-1 gap-3 rounded-xl px-3 py-2"} ${light ? "bg-white/10 text-white" : "bg-sand text-pine"}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-[10px] font-semibold ${light ? "bg-white text-pine" : "bg-panel"}`}>PDF</span>
      <span className="min-w-0 truncate text-sm font-medium">{label}</span>
    </a>
  );
}
