"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { stockNote } from "@/lib/facts";
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
  sources = [],
}: {
  card: CardRow;
  files: string[];
  supplier: SupplierRow | null;
  sources?: { file: string; name: string }[];
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

  const sample = (extra.reference || "").startsWith("SAMPLE");
  const rooms = card.property_type === "apartment" || card.property_type === "villa" || card.property_type === "townhouse" || !card.property_type;
  const dated = card.property_type === "apartment" || card.property_type === "villa" || card.property_type === "townhouse" || !card.property_type;

  const facts = [
    { icon: "building" as const, value: label(PROPERTY_LABELS, card.property_type) },
    ...(rooms
      ? [
          { icon: "bed" as const, value: card.bedrooms === null ? "N/A" : formatRooms(card.bedrooms) },
          { icon: "bath" as const, value: card.bathrooms === null ? "N/A" : String(card.bathrooms) },
        ]
      : []),
    { icon: "size" as const, value: sizeLabel(card.size_sqm) },
  ];

  return (
    <>
      <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          {files[active] ? (
            <button
              type="button"
              onClick={() => setOpen(active)}
              className="block aspect-[4/3] w-full overflow-hidden rounded-2xl border border-line bg-sand"
            >
              <img src={`/api/media/${files[active]}`} alt="" className="h-full w-full object-cover object-top" />
            </button>
          ) : (
            <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-sand">
              <img src="/newton-logo.png" alt="" className="h-12 w-20 rounded-lg object-contain" />
              <p className="text-sm font-medium text-ink">No photo yet</p>
            </div>
          )}
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

        <div className="desk-card rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-3xl font-semibold tracking-tight text-leaf">{formatPrice(card.price, card.currency)}</p>
              {stockNote(card) ? <p className="mt-1 text-sm font-medium text-clay">{stockNote(card)}</p> : null}
            </div>
            {sample ? <span className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-semibold text-pine">Sample</span> : null}
          </div>
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
          {sources.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {sources.map((source) => (
                <a key={source.file} href={`/api/media/${source.file}`} target="_blank" rel="noreferrer" className="rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white">
                  Source PDF
                </a>
              ))}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-pine">{label(PURPOSE_LABELS, card.purpose)}</span>
            {dated && extra.handover ? <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-pine">Handover {extra.handover}</span> : null}
            {plan ? <span className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-pine">{plan}</span> : null}
          </div>

          <div className="mt-5 flex gap-3 rounded-2xl border border-line bg-paper p-4">
            {supplier?.company_logo ? (
              <img src={`/api/media/${supplier.company_logo}`} alt="" className="h-14 w-14 rounded-2xl object-cover" />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-pine text-white">
                <Icon name={card.kind === "inquiry" ? "user" : "building"} className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{card.kind === "inquiry" ? "Client" : "Employee"}</p>
            <p className="mt-1 font-semibold">{supplier?.name || card.sender_name || "Unnamed"}</p>
            {supplier?.company_id && supplier.company_name ? (
              <Link href={`/suppliers/${supplier.company_id}`} className="text-sm font-medium text-leaf">
                {supplier.company_name}
              </Link>
            ) : (
              <p className="text-sm text-muted">No developer yet</p>
            )}
            <p className="mt-1 text-sm">{formatPhone(phone) || "No mobile number"}</p>
            <div className="mt-3">
              <WhatsAppLink phone={phone} />
            </div>
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
