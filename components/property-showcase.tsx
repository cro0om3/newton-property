"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { formatPhone, formatPrice, formatRooms, label, PROPERTY_LABELS, PURPOSE_LABELS } from "@/lib/format";
import type { CardExtra, CardRow, SupplierRow } from "@/lib/types";

function parseExtra(raw: string | null): CardExtra {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CardExtra;
  } catch {
    return {};
  }
}

function sizeLabel(sqm: number | null) {
  if (sqm == null) return "N/A";
  const sqft = Math.round(sqm * 10.7639);
  return `${sqm} sqm · ${sqft.toLocaleString("en-US")} sqft`;
}

export function PropertyShowcase({
  card,
  files,
  supplier,
}: {
  card: CardRow;
  files: string[];
  supplier: SupplierRow | null;
}) {
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const extra = parseExtra(card.extra);
  const plan = extra.planLabel || extra.plans?.[0]?.name || null;
  const phone = supplier?.phone || card.sender_phone;

  useEffect(() => {
    if (open === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
      if (event.key === "ArrowRight") setOpen((current) => (current === null ? current : (current + 1) % files.length));
      if (event.key === "ArrowLeft") setOpen((current) => (current === null ? current : (current - 1 + files.length) % files.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, files.length]);

  const facts = [
    { icon: "building" as const, value: label(PROPERTY_LABELS, card.property_type) },
    ...(card.property_type === "land" ? [] : [
      { icon: "bed" as const, value: card.bedrooms === null ? "N/A" : formatRooms(card.bedrooms) },
      { icon: "bath" as const, value: card.bathrooms === null ? "N/A" : String(card.bathrooms) },
    ]),
    { icon: "size" as const, value: sizeLabel(card.size_sqm) },
  ];

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <button
            type="button"
            onClick={() => files.length && setOpen(active)}
            className="block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-sand"
          >
            {files[active] ? (
              <img src={`/api/media/${files[active]}`} alt="" className="h-full w-full object-cover object-top" />
            ) : (
              <span className="flex h-full items-center justify-center text-sm text-muted">No photo yet</span>
            )}
          </button>
          {files.length > 1 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {files.map((file, index) => (
                <button
                  key={file}
                  type="button"
                  onClick={() => setActive(index)}
                  className={`h-16 w-20 shrink-0 overflow-hidden rounded-xl border bg-panel ${index === active ? "border-leaf" : "border-line"}`}
                >
                  <img src={`/api/media/${file}`} alt="" className="h-full w-full object-cover object-top" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-3xl font-semibold tracking-tight text-leaf">{formatPrice(card.price, card.currency)}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {facts.map((fact) => (
              <div key={fact.icon + fact.value} className="flex items-center gap-2 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sand text-pine">
                  <Icon name={fact.icon} className="h-4 w-4" />
                </span>
                <span>{fact.value}</span>
              </div>
            ))}
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{card.title || "Untitled"}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Icon name="pin" className="h-4 w-4" />
            {[card.area, card.city].filter(Boolean).join(", ") || "N/A"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-pine">{label(PURPOSE_LABELS, card.purpose)}</span>
            <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-pine">Handover {extra.handover || "N/A"}</span>
            <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-pine">{plan || "Payment plan N/A"}</span>
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-paper p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{card.kind === "inquiry" ? "Client" : "Listed by"}</p>
            <p className="mt-1 font-semibold">{supplier?.name || card.sender_name || "Unnamed"}</p>
            <p className="text-sm text-muted">{supplier?.company_name || "Company not set"}</p>
            <p className="mt-1 text-sm">{formatPhone(phone) || "No mobile number"}</p>
            <div className="mt-3">
              <WhatsAppLink phone={phone} />
            </div>
          </div>
        </div>
      </div>

      {open !== null && files[open] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-pine/80 p-4" onClick={() => setOpen(null)}>
          <button type="button" className="absolute right-4 top-4 rounded-full bg-panel px-3 py-1 text-sm" onClick={() => setOpen(null)}>
            Close
          </button>
          <button
            type="button"
            className="absolute left-4 rounded-full bg-panel px-3 py-2 text-sm"
            onClick={(event) => {
              event.stopPropagation();
              setOpen((open - 1 + files.length) % files.length);
            }}
          >
            Prev
          </button>
          <img src={`/api/media/${files[open]}`} alt="" className="max-h-[85vh] max-w-[80vw] rounded-2xl object-contain" onClick={(event) => event.stopPropagation()} />
          <button
            type="button"
            className="absolute right-4 rounded-full bg-panel px-3 py-2 text-sm"
            onClick={(event) => {
              event.stopPropagation();
              setOpen((open + 1) % files.length);
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </>
  );
}
