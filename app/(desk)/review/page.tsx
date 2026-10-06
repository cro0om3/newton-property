"use client";

import { useEffect, useState } from "react";
import { PropertyCard } from "@/components/property-card";
import type { CardRow } from "@/lib/types";

export default function ReviewPage() {
  const [cards, setCards] = useState<CardRow[] | null>(null);

  async function load() {
    const response = await fetch("/api/cards?status=needs_review");
    if (!response.ok) return;
    const body = await response.json();
    setCards(body.cards);
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

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <h1 className="text-3xl font-semibold tracking-tight">Review</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        These messages look like properties, but a price, area, or type was missing. Approve the ones you want on the main desk.
      </p>
      <div className="mt-6 space-y-4">
        {(cards || []).map((card) => (
          <div key={card.id}>
            <PropertyCard card={card} />
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
      </div>
      {cards && cards.length === 0 ? <p className="mt-8 text-sm text-muted">Nothing is waiting for review.</p> : null}
    </div>
  );
}
