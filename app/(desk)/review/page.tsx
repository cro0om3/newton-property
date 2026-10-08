"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PropertyCard } from "@/components/property-card";
import type { CardRow } from "@/lib/types";

export default function ReviewPage() {
  const [cards, setCards] = useState<CardRow[] | null>(null);
  const [pending, setPending] = useState(0);

  async function load() {
    const [cardsResponse, statsResponse] = await Promise.all([fetch("/api/cards"), fetch("/api/stats")]);
    if (cardsResponse.ok) {
      const body = await cardsResponse.json();
      setCards(body.cards || []);
    }
    if (statsResponse.ok) {
      const body = await statsResponse.json();
      setPending(body.pendingSort || 0);
    }
  }

  useEffect(() => {
    void load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  const review = (cards || []).filter((card) => card.status === "needs_review");
  const unassigned = (cards || []).filter((card) => card.status !== "closed" && card.status !== "needs_review" && !card.broker);
  const clear = cards && review.length === 0 && unassigned.length === 0 && pending === 0;

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <h1 className="text-3xl font-semibold tracking-tight">Review</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Records that still need a decision: incomplete details, or no broker yet.
      </p>

      {pending > 0 ? (
        <Link href="/inbox" className="mt-5 block desk-card rounded-2xl border border-line bg-panel px-4 py-3 text-sm">
          <span className="font-medium">{pending} messages are still unsorted.</span>
          <span className="mt-1 block text-muted">Open WhatsApp and save the useful ones as a property or a client.</span>
        </Link>
      ) : null}

      <section className="mt-6">
        <h2 className="font-semibold">Needs a decision</h2>
        <div className="mt-3 space-y-4">
          {review.map((card) => (
            <div key={card.id}>
              <PropertyCard card={card} onDeleted={() => setCards((current) => (current || []).filter((item) => item.id !== card.id))} />
              <div className="mt-2 flex gap-2">
                <button onClick={() => setStatus(card.id, "new")} className="rounded-xl bg-pine px-3 py-2 text-sm text-white">
                  Approve
                </button>
                <button onClick={() => setStatus(card.id, "closed")} className="rounded-xl border border-line bg-panel px-3 py-2 text-sm">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
          {cards && review.length === 0 ? <p className="text-sm text-muted">Nothing is waiting for a decision.</p> : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">No broker yet</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {unassigned.map((card) => (
            <PropertyCard key={card.id} card={card} onDeleted={() => setCards((current) => (current || []).filter((item) => item.id !== card.id))} />
          ))}
          {cards && unassigned.length === 0 ? <p className="text-sm text-muted">Every open record has a broker.</p> : null}
        </div>
      </section>

      {clear ? <p className="mt-8 text-sm font-medium text-pine">The queue is clear.</p> : null}
    </div>
  );
}
