import Link from "next/link";
import { Icon } from "@/components/icons";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { cardSlots, stockNote } from "@/lib/facts";
import { formatPhone, formatPrice, formatWhen, purposeLabel, statusLabel } from "@/lib/format";
import type { CardExtra, CardRow } from "@/lib/types";

function readPlans(raw: string | null) {
  if (!raw) return [];
  try {
    return ((JSON.parse(raw) as CardExtra).plans || []).filter((plan) => plan.price);
  } catch {
    return [];
  }
}

export function PropertyCard({ card, onDeleted }: { card: CardRow; onDeleted?: () => void }) {
  const place = [card.area, card.city].filter(Boolean).join(", ");
  const plans = readPlans(card.extra);
  const price = plans.length
    ? Math.min(...plans.map((plan) => plan.discountedPrice || plan.price))
    : card.price;
  const slots = cardSlots(card);

  const href = card.kind === "inquiry" ? `/clients/${card.id}` : `/properties/${card.id}`;
  const phone = formatPhone(card.sender_phone);

  async function remove() {
    if (!window.confirm("Delete this record?")) return;
    const response = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    if (response.ok) onDeleted?.();
  }

  return (
    <article className="desk-card group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-panel transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(7,24,51,0.12)]">
      <Link href={href} className="absolute inset-0 z-0" aria-label={card.title || "Open"} />
      <div className="pointer-events-none relative h-36 overflow-hidden bg-sand">
        {card.cover ? (
          <img
            src={`/api/media/${card.cover}`}
            alt=""
            className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-1 bg-sand text-[11px] font-medium text-muted">
            <img src="/newton-logo.png" alt="" className="h-8 w-14 object-contain" />
            No photo
          </span>
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-pine px-2 py-1 text-[11px] font-semibold tracking-wide text-white">
          <Icon name="tag" className="h-3 w-3" />
          {card.kind === "listing" ? purposeLabel(card.purpose) : "Inquiry"}
        </span>
        <button
          type="button"
          title="Delete"
          aria-label="Delete"
          onClick={() => void remove()}
          className="pointer-events-auto absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white text-clay shadow-sm hover:bg-sand"
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="pointer-events-none relative flex flex-1 flex-col px-4 py-3.5">
        <p className="text-lg font-semibold tracking-tight text-pine">
          {plans.length > 1 ? "From " : ""}
          {formatPrice(price, card.currency)}
        </p>
        {stockNote(card) ? <p className="mt-1 text-xs font-medium text-clay">{stockNote(card)}</p> : null}
        <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug">{card.title || "Untitled property"}</h3>
        <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-muted">
          <Icon name="pin" className="h-3.5 w-3.5 shrink-0" />
          {place || "Area not set"}
        </p>
        {slots.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
            {slots.map((slot) => (
              <p key={slot.key} className={`flex items-center gap-1.5 text-xs ${slot.empty ? "text-muted" : "text-ink"}`}>
                <Icon name={slot.icon} className="h-3.5 w-3.5 shrink-0 text-pine" />
                <span className="truncate">{slot.value}</span>
              </p>
            ))}
          </div>
        ) : null}
        <div className="pointer-events-auto relative z-10 mt-3 flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <Icon name={card.broker ? "user" : "chat"} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{card.sender_name || card.broker || "Unassigned"} · {statusLabel(card.status)}</span>
          </p>
          <span className="flex shrink-0 items-center gap-1">
            <Link href={`${href}?edit=1`} title="Edit" aria-label="Edit" className="grid h-8 w-8 place-items-center rounded-full border border-line bg-panel text-pine hover:bg-sand">
              <Icon name="pencil" className="h-3.5 w-3.5" />
            </Link>
            <WhatsAppLink phone={phone === "—" ? null : phone} />
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted">{formatWhen(card.updated_at)}</p>
      </div>
    </article>
  );
}
