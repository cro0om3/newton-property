"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, IconBadge, type IconName } from "@/components/icons";
import { formatPrice, propertyLabel } from "@/lib/format";
import type { CardRow } from "@/lib/types";

type Stats = {
  listings: number;
  inquiries: number;
  villas: number;
  apartments: number;
  land: number;
  needsReview: number;
  newToday: number;
};

export default function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);

  useEffect(() => {
    void fetch("/api/stats")
      .then((response) => response.json())
      .then(setStats);
    void fetch("/api/cards")
      .then((response) => response.json())
      .then((body) => setCards(body.cards || []));
  }, []);

  const totals: Array<{ label: string; value: number | string; icon: IconName }> = [
    { label: "New today", value: stats?.newToday ?? "—", icon: "calendar" },
    { label: "Listings", value: stats?.listings ?? "—", icon: "building" },
    { label: "Inquiries", value: stats?.inquiries ?? "—", icon: "search" },
    { label: "Villas", value: stats?.villas ?? "—", icon: "home" },
    { label: "Apartments", value: stats?.apartments ?? "—", icon: "building" },
    { label: "Land", value: stats?.land ?? "—", icon: "land" },
  ];

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-2 text-sm text-muted">Owner summary, an Excel sheet, and a PDF for each property.</p>
        </div>
        <a href="/api/reports/excel" className="inline-flex items-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-sm font-medium text-white">
          <Icon name="download" className="h-4 w-4" />
          Download Excel
        </a>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {totals.map((item) => (
          <article key={item.label} className="flex items-center gap-3 desk-card rounded-2xl border border-line bg-panel px-4 py-4">
            <IconBadge name={item.icon} />
            <div>
              <p className="text-sm text-muted">{item.label}</p>
              <p className="text-2xl font-semibold tracking-tight text-pine">{item.value}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="mt-6 overflow-hidden desk-card rounded-2xl border border-line bg-panel">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-semibold">Sheets</h2>
          <p className="text-sm text-muted">{stats?.needsReview ?? 0} need review</p>
        </div>
        <div className="divide-y divide-line">
          {cards.map((card) => (
            <div key={card.id} className="flex items-center gap-4 px-5 py-3">
              <IconBadge name={card.property_type === "land" ? "land" : card.property_type === "villa" ? "home" : "building"} />
              <div className="min-w-0 flex-1">
                <Link href={card.kind === "inquiry" ? `/clients/${card.id}` : `/properties/${card.id}`} className="block truncate font-medium">
                  {card.title || "Untitled property"}
                </Link>
                <p className="text-sm text-muted">
                  {propertyLabel(card.property_type)} · {[card.area, card.city].filter(Boolean).join(", ") || "N/A"}
                </p>
              </div>
              <p className="hidden text-sm font-semibold text-pine sm:block">{formatPrice(card.price, card.currency)}</p>
              <a href={`/api/reports/property/${card.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-pine">
                <Icon name="file" className="h-4 w-4" />
                PDF
              </a>
            </div>
          ))}
          {cards.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No properties to export yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
