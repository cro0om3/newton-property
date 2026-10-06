"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Attachment } from "@/components/attachment";
import { ReplyBox } from "@/components/reply-box";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { DetailsForm } from "@/components/details-form";
import { IconBadge } from "@/components/icons";
import { PaymentPlans } from "@/components/payment-plans";
import { PropertyShowcase } from "@/components/property-showcase";
import { dealFacts, propertyFacts } from "@/lib/facts";
import { PIPELINE, formatPrice, formatWhen, statusLabel } from "@/lib/format";
import type { CardExtra, CardRow, FollowUp, MessageRow, SupplierRow } from "@/lib/types";

function readExtra(raw: string | null): CardExtra | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CardExtra;
  } catch {
    return null;
  }
}

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const [card, setCard] = useState<CardRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [matches, setMatches] = useState<Array<{ card: CardRow; score: number; reason: string }>>([]);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [broker, setBroker] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  const pathname = usePathname();

  async function load() {
    const response = await fetch(`/api/cards/${params.id}`);
    if (response.status === 404) {
      setMissing(true);
      return;
    }
    if (!response.ok) return;
    const body = await response.json();
    setCard(body.card);
    setMessages(body.messages);
    setGallery(body.gallery || []);
    setFollowUps(body.followUps || []);
    setMatches(body.matches || []);
    setSupplier(body.supplier || null);
    setBroker(body.card.broker || "");
    setNextDate(dateInput(body.card.next_follow_up));
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function saveDesk(extra?: { status?: string; note?: string }) {
    await fetch(`/api/cards/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: extra?.status,
        broker,
        nextFollowUp: nextDate || null,
        note: extra?.note ?? note,
      }),
    });
    setNote("");
    await load();
  }

  async function setStatus(status: string) {
    await fetch(`/api/cards/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  if (missing) {
    return (
      <div className="px-8 py-7">
        <p>This property is no longer here.</p>
        <Link href="/properties" className="mt-3 inline-block text-sm text-leaf">
          Back to properties
        </Link>
      </div>
    );
  }

  if (!card) return <div className="px-8 py-7 text-sm text-muted">Loading...</div>;

  const clientRecord = card.kind === "inquiry" || pathname.startsWith("/clients");
  const listHref = clientRecord ? "/clients" : "/properties";

  const extra = readExtra(card.extra);
  const plans = extra?.plans || [];
  const specs = propertyFacts(card);
  const deal = dealFacts(card);

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <Link href={listHref} className="text-sm font-medium text-leaf">
        {clientRecord ? "All clients" : "All properties"}
      </Link>
      <div className="mt-4">
        <PropertyShowcase card={card} files={gallery} supplier={supplier} />
      </div>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-muted">{card.summary}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href={`/api/reports/property/${card.id}`}
            className="rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white"
          >
            Download PDF
          </a>
          {PIPELINE.map((status) => (
            <button
              key={status}
              onClick={() => setStatus(status)}
              className={`rounded-xl px-3 py-2 text-sm ${card.status === status ? "bg-pine text-white" : "border border-line bg-panel"}`}
            >
              {statusLabel(status)}
            </button>
          ))}
      </div>

      <DetailsForm key={`${card.updated_at}-${supplier?.name || ""}-${supplier?.company_name || ""}`} card={card} supplier={supplier} onSaved={() => void load()} />

      <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Contact</h2>
          <WhatsAppLink phone={card.sender_phone} label={card.sender_phone || undefined} />
        </div>
        <div className="mt-4">
          <ReplyBox chatJid={card.chat_jid} cardId={card.id} />
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-semibold">Follow-up</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input value={broker} onChange={(event) => setBroker(event.target.value)} placeholder="Broker name" className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <button type="button" onClick={() => void saveDesk({ note: "" })} className="rounded-xl bg-pine px-4 py-2 text-sm font-medium text-white">
            Save
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Call, viewing, or offer note" className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <button type="button" onClick={() => void saveDesk()} className="rounded-xl border border-line px-4 py-2 text-sm font-medium">
            Log note
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {followUps.map((item) => (
            <article key={item.id} className="rounded-xl bg-paper px-4 py-3">
              <p className="text-xs text-muted">{item.broker || "Broker"} · {formatWhen(item.created_at)}</p>
              <p className="mt-1 text-sm">{item.note}</p>
            </article>
          ))}
          {followUps.length === 0 ? <p className="text-sm text-muted">No follow-up notes yet.</p> : null}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">{clientRecord ? "Matching properties" : "Matching clients"}</h2>
        <div className="mt-3 grid gap-3">
          {matches.map((match) => (
            <Link
              key={match.card.id}
              href={match.card.kind === "inquiry" ? `/clients/${match.card.id}` : `/properties/${match.card.id}`}
              className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-4 py-3"
            >
              <div>
                <p className="font-medium">{match.card.title || "Untitled"}</p>
                <p className="text-sm text-muted">{match.reason}</p>
              </div>
              <p className="text-sm font-semibold text-pine">{formatPrice(match.card.price, match.card.currency)}</p>
            </Link>
          ))}
          {matches.length === 0 ? <p className="text-sm text-muted">No close match yet. Add area, type, beds, and budget to improve this.</p> : null}
        </div>
      </section>

      <PaymentPlans plans={plans} />

      <section className="mt-6">
        <h2 className="font-semibold">Property details</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {specs.map((item) => (
            <div key={item.key} className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3">
              <IconBadge name={item.icon} />
              <div className="min-w-0">
                <dt className="text-xs text-muted">{item.label}</dt>
                <dd className={`mt-0.5 truncate text-sm font-medium ${item.empty ? "text-muted" : "text-ink"}`}>{item.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>
      <section className="mt-6">
        <h2 className="font-semibold">Deal</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {deal.map((item) => (
            <div key={item.key} className="flex items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-3">
              <IconBadge name={item.icon} />
              <div className="min-w-0">
                <dt className="text-xs text-muted">{item.label}</dt>
                <dd className={`mt-0.5 truncate text-sm font-medium ${item.empty ? "text-muted" : "text-ink"}`}>{item.value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <h2 className="font-semibold">Original messages</h2>
        <div className="mt-4 space-y-3">
          {messages.map((message) => (
            <article key={message.id} className="rounded-xl bg-paper px-4 py-3">
              <p className="text-xs text-muted">
                {message.sender_name || message.sender_phone || "Sender"} · {formatWhen(message.timestamp)}
              </p>
              <Attachment message={message} />
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-muted">Message text</summary>
                <p dir="auto" className="mt-2 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-6">
                  {message.body}
                </p>
              </details>
            </article>
          ))}
          {messages.length === 0 ? <p className="text-sm text-muted">No source messages linked.</p> : null}
        </div>
      </section>
    </div>
  );
}

function dateInput(value: number | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
