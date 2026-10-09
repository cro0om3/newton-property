"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Attachment } from "@/components/attachment";
import { ReplyBox } from "@/components/reply-box";
import { DetailsForm } from "@/components/details-form";
import { Icon, IconBadge } from "@/components/icons";
import { PaymentPlans } from "@/components/payment-plans";
import { PropertyShowcase } from "@/components/property-showcase";
import { askForGaps, dealFacts, propertyFacts, reviewReasons } from "@/lib/facts";
import { useDeskPrefs } from "@/components/shell";
import { PIPELINE, deskZone, formatPrice, formatWhen, statusLabel } from "@/lib/format";
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
  const router = useRouter();
  const search = useSearchParams();
  const [editSignal, setEditSignal] = useState(0);
  const [card, setCard] = useState<CardRow | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [matches, setMatches] = useState<Array<{ card: CardRow; score: number; reason: string }>>([]);
  const [supplier, setSupplier] = useState<SupplierRow | null>(null);
  const [broker, setBroker] = useState("");
  const [brokers, setBrokers] = useState<string[]>([]);
  const [campaign, setCampaign] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [campaignNote, setCampaignNote] = useState("");
  const office = useDeskPrefs();
  const campaignCard = useRef("");
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
    const nextMatches = (body.matches || []) as Array<{ card: CardRow; score: number; reason: string }>;
    setMatches(nextMatches);
    if (campaignCard.current !== body.card.id) {
      campaignCard.current = body.card.id;
      setCampaign(draftFor(body.card, office.officeName));
      setPicked(nextMatches.filter((match) => canReach(match.card)).map((match) => match.card.id));
    }
    setSupplier(body.supplier || null);
    setBroker(body.card.broker || "");
    setNextDate(dateInput(body.card.next_follow_up));
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  useEffect(() => {
    void fetch("/api/settings")
      .then((response) => response.json())
      .then((body) => setBrokers(Array.isArray(body.settings?.brokers) ? body.settings.brokers : []));
  }, []);

  useEffect(() => {
    if (search.get("edit") === "1") setEditSignal((value) => value + 1);
  }, [search]);

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

  async function removeRecord() {
    if (!card) return;
    const client = card.kind === "inquiry" || pathname.startsWith("/clients");
    if (!window.confirm(`Delete this ${client ? "client" : "property"}?`)) return;
    const response = await fetch(`/api/cards/${params.id}`, { method: "DELETE" });
    if (!response.ok) return;
    router.push(client ? "/clients" : "/properties");
  }

  async function sendCampaign() {
    if (!picked.length || !campaign.trim()) return;
    const count = picked.length;
    if (!window.confirm(`Send this message to ${count} client${count === 1 ? "" : "s"}? They leave one every 45 seconds.`)) return;
    const response = await fetch(`/api/cards/${params.id}/campaign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: campaign, clientIds: picked }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setCampaignNote(body?.error || "Could not queue the messages");
      return;
    }
    setCampaignNote(`Queued ${body.queued}. The first leaves now, then one every ${body.gapSeconds} seconds.`);
    await load();
  }

  async function removeFollowUp(id: string) {
    if (!window.confirm("Delete this note?")) return;
    await fetch(`/api/cards/${params.id}?followUp=${encodeURIComponent(id)}`, { method: "DELETE" });
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
        <PropertyShowcase
          card={card}
          files={gallery}
          supplier={supplier}
          sources={[...new Map(messages.filter((message) => message.media_file?.endsWith(".pdf")).map((message) => [message.media_file, { file: message.media_file as string, name: "Source PDF" }])).values()]}
        />
      </div>
      <section className="mt-4 desk-card rounded-2xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" title="Edit" aria-label="Edit" onClick={() => setEditSignal((value) => value + 1)} className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper text-pine">
            <Icon name="pencil" className="h-4 w-4" />
          </button>
          <button type="button" title="Delete" aria-label="Delete" onClick={() => void removeRecord()} className="grid h-9 w-9 place-items-center rounded-full border border-line bg-paper text-clay">
            <Icon name="trash" className="h-4 w-4" />
          </button>
          <a href={`/api/reports/property/${card.id}`} className="rounded-xl border border-line bg-paper px-3 py-2 text-sm font-medium">
            Download PDF
          </a>
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Status</span>
          {PIPELINE.map((status) => (
            <button
              key={status}
              onClick={() => setStatus(status)}
              className={`rounded-xl px-3 py-2 text-sm ${card.status === status ? "bg-pine text-white" : "border border-line bg-paper"}`}
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
      </section>
      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.75fr)]">
        <div className="min-w-0">
          {card.status === "needs_review" ? (
            <div className="mb-4 rounded-2xl border border-line bg-panel px-4 py-3">
              <p className="text-sm font-medium">Why this is not approved</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-muted">
                {reviewReasons(card).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {card.summary ? <p className="max-w-3xl text-sm leading-6 text-muted">{card.summary}</p> : null}
          {askForGaps(card, messages.some((message) => /[\u0600-\u06FF]/.test(message.body || ""))) ? (
            <section className="mt-4 desk-card rounded-2xl border border-line bg-panel p-5">
              <h2 className="font-semibold">Ask for what is missing</h2>
              <p className="mt-1 text-sm text-muted">This stays here until you press Send. Nothing goes out by itself.</p>
              <div className="mt-3">
                <ReplyBox
                  chatJid={card.chat_jid}
                  cardId={card.id}
                  initialText={askForGaps(card, messages.some((message) => /[\u0600-\u06FF]/.test(message.body || "")))}
                />
              </div>
            </section>
          ) : null}
          <DetailsForm key={`${card.updated_at}-${supplier?.name || ""}-${supplier?.company_name || ""}`} card={card} supplier={supplier} openSignal={editSignal} onSaved={() => void load()} />
          <PaymentPlans plans={plans} />
          <section className="mt-6">
            <h2 className="font-semibold">Property details</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {specs.map((item) => (
                <div key={item.key} className="flex items-center gap-3 desk-card rounded-2xl border border-line bg-panel px-4 py-3">
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
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              {deal.map((item) => (
                <div key={item.key} className="flex items-center gap-3 desk-card rounded-2xl border border-line bg-panel px-4 py-3">
                  <IconBadge name={item.icon} />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">{item.label}</dt>
                    <dd className={`mt-0.5 truncate text-sm font-medium ${item.empty ? "text-muted" : "text-ink"}`}>{item.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>
          {messages.length ? (
            <section className="mt-6 desk-card rounded-2xl border border-line bg-panel p-5">
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
              </div>
            </section>
          ) : null}
        </div>
        <div className="min-w-0 space-y-4">
          {askForGaps(card, false) ? null : (
            <section className="desk-card rounded-2xl border border-line bg-panel p-5">
              <h2 className="font-semibold">Reply</h2>
              <div className="mt-4">
                <ReplyBox chatJid={card.chat_jid} cardId={card.id} />
              </div>
            </section>
          )}
          <section className="desk-card rounded-2xl border border-line bg-panel p-5">
            <h2 className="font-semibold">Follow-up</h2>
            <div className="mt-4 grid gap-3">
              <input value={broker} onChange={(event) => setBroker(event.target.value)} placeholder="Broker name" list="desk-brokers" className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
              <datalist id="desk-brokers">{brokers.map((name) => <option key={name} value={name} />)}</datalist>
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
                <article key={item.id} className="flex items-start justify-between gap-2 rounded-xl bg-paper px-4 py-3">
                  <div>
                    <p className="text-xs text-muted">{item.broker || "Broker"} · {formatWhen(item.created_at)}</p>
                    <p className="mt-1 text-sm">{item.note}</p>
                  </div>
                  <button type="button" title="Delete note" aria-label="Delete note" onClick={() => void removeFollowUp(item.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-clay hover:bg-sand">
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </article>
              ))}
              {followUps.length === 0 ? <p className="text-sm text-muted">No follow-up notes yet.</p> : null}
            </div>
          </section>
          {!clientRecord ? (
            <section className="desk-card rounded-2xl border border-line bg-panel p-5">
              <h2 className="font-semibold">Share with matching clients</h2>
              <p className="mt-1 text-sm text-muted">Only people who already have a WhatsApp chat. Messages leave one every 45 seconds after you confirm.</p>
              <textarea value={campaign} onChange={(event) => setCampaign(event.target.value)} rows={6} className="mt-4 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
              <div className="mt-3 space-y-2">
                {matches.map((match) => {
                  const reachable = canReach(match.card);
                  return (
                    <label key={match.card.id} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 accent-pine"
                        disabled={!reachable}
                        checked={picked.includes(match.card.id)}
                        onChange={(event) => {
                          setPicked((current) => event.target.checked ? [...current, match.card.id] : current.filter((item) => item !== match.card.id));
                        }}
                      />
                      <span>
                        <span className="font-medium">{match.card.sender_name || match.card.title || "Client"}</span>
                        <span className="block text-muted">{reachable ? match.reason : "No WhatsApp chat yet"}</span>
                      </span>
                    </label>
                  );
                })}
                {matches.length === 0 ? <p className="text-sm text-muted">No close match yet.</p> : null}
              </div>
              <button
                type="button"
                onClick={() => void sendCampaign()}
                disabled={!picked.length || !campaign.trim()}
                className="mt-4 rounded-xl bg-pine px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Send to selected
              </button>
              {campaignNote ? <p className={`mt-2 text-sm ${campaignNote.startsWith("Queued") ? "text-leaf" : "text-clay"}`}>{campaignNote}</p> : null}
            </section>
          ) : null}
          <section>
            <h2 className="font-semibold">{clientRecord ? "Matching properties" : "Matching clients"}</h2>
            <div className="mt-3 grid gap-3">
              {matches.map((match) => (
                <Link
                  key={match.card.id}
                  href={match.card.kind === "inquiry" ? `/clients/${match.card.id}` : `/properties/${match.card.id}`}
                  className="desk-card flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{match.card.title || "Untitled"}</p>
                    <p className="text-sm text-muted">{match.reason}</p>
                  </div>
                  <p className="text-sm font-semibold text-pine">{formatPrice(match.card.price, match.card.currency)}</p>
                </Link>
              ))}
              {matches.length === 0 ? <p className="text-sm text-muted">No close match yet.</p> : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function canReach(card: CardRow) {
  return Boolean(card.chat_jid && card.chat_jid !== "desk" && !card.chat_jid.endsWith("@g.us"));
}

function draftFor(card: CardRow, officeName: string) {
  const place = [card.area, card.city].filter(Boolean).join(", ");
  const price = formatPrice(card.price, card.currency);
  return [
    `Hello, this is ${officeName || "Newton Property"}.`,
    "",
    `We have ${card.title || "a property"}${place ? ` in ${place}` : ""}.`,
    price === "Price not set" ? "" : `Price: ${price}.`,
    "",
    "I can send the payment plan and arrange a viewing.",
  ].join("\n").replace(/\n{3,}/g, "\n\n");
}

function dateInput(value: number | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: deskZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
