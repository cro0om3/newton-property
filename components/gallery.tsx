"use client";

import { useEffect, useState } from "react";

export function Gallery({ files }: { files: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowRight") setOpen((current) => (current === null ? current : (current + 1) % files.length));
      if (event.key === "ArrowLeft") {
        setOpen((current) => (current === null ? current : (current - 1 + files.length) % files.length));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, files.length]);

  if (!files.length) return null;

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Photos</h2>
        <p className="text-sm text-muted">{files.length} {files.length === 1 ? "image" : "images"}</p>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {files.map((file, index) => (
          <button
            key={file}
            type="button"
            onClick={() => setOpen(index)}
            className="h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-panel"
          >
            <img src={`/api/media/${file}`} alt="" className="h-full w-full object-cover object-top" />
          </button>
        ))}
      </div>
      {open !== null ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#061226]/85 p-4"
          onClick={() => setOpen(null)}
        >
          <div className="flex max-h-full max-w-5xl items-center gap-3" onClick={(event) => event.stopPropagation()}>
            {files.length > 1 ? (
              <button
                type="button"
                onClick={() => setOpen((open - 1 + files.length) % files.length)}
                className="rounded-full bg-white/15 px-3 py-2 text-sm text-white"
              >
                Prev
              </button>
            ) : null}
            <figure className="min-w-0">
              <img
                src={`/api/media/${files[open]}`}
                alt=""
                className="max-h-[82vh] max-w-[70vw] rounded-2xl object-contain"
              />
              <figcaption className="mt-2 text-center text-sm text-white/80">
                {open + 1} / {files.length}
              </figcaption>
            </figure>
            {files.length > 1 ? (
              <button
                type="button"
                onClick={() => setOpen((open + 1) % files.length)}
                className="rounded-full bg-white/15 px-3 py-2 text-sm text-white"
              >
                Next
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
