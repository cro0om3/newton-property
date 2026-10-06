"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBadge, type IconName } from "@/components/icons";
import { PropertyCard } from "@/components/property-card";
import type { WaStatus } from "@/lib/status";
import type { CardRow } from "@/lib/types";

type Stats = {
  newToday: number;
  listings: number;
  inquiries: number;
  needsReview: number;
  villas: number;
  apartments: number;
  pendingSort: number;
  messages: number;
  recent: CardRow[];
  recentClients: CardRow[];
  viewings: number;
  unassigned: number;
  whatsapp: WaStatus;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch("/api/stats");
      if (!response.ok || stop) return;
      setStats(await response.json());
    }
    void load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  const cards: Array<{ label: string; value: number | string; href: string; icon: IconName }> = [
    { label: "Properties", value: stats?.listings ?? "—", href: "/properties", icon: "building" },
    { label: "Clients", value: stats?.inquiries ?? "—", href: "/clients", icon: "user" },
    { label: "Viewings", value: stats?.viewings ?? "—", href: "/properties?status=viewing", icon: "calendar" },
    { label: "Unassigned", value: stats?.unassigned ?? "—", href: "/review", icon: "check" },
  ];

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <p className="text-sm text-muted">Today</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Properties, clients, and follow-up live here. WhatsApp is one way new stock and new buyers enter the desk.
      </p>

      {!stats?.whatsapp.openai ? (
        <div className="mt-6 rounded-2xl border border-leaf/20 bg-sand px-4 py-3 text-sm text-ink">
          Add your OpenAI API key in the .env file, then restart. Messages are saved now and sorting starts after the key is set.
        </div>
      ) : null}
      {stats?.whatsapp.lastError ? (
        <div className="mt-4 rounded-2xl border border-leaf/20 bg-sand px-4 py-3 text-sm text-ink">
          {stats.whatsapp.lastError}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="flex items-start justify-between rounded-2xl border border-line bg-panel px-4 py-4">
            <div>
              <p className="text-sm text-muted">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-pine">{card.value}</p>
            </div>
            <IconBadge name={card.icon} />
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Latest properties</h2>
            <Link href="/properties" className="text-sm font-medium text-leaf">
              View all
            </Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(stats?.recent || []).map((card) => (
              <PropertyCard key={card.id} card={card} />
            ))}
            {stats && stats.recent.length === 0 ? (
              <p className="text-sm text-muted">Nothing sorted yet. Link WhatsApp and new property messages will land here.</p>
            ) : null}
          </div>
        </section>
        <div>
        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Latest clients</h2>
            <Link href="/clients" className="text-sm font-medium text-leaf">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {(stats?.recentClients || []).map((card) => (
              <Link key={card.id} href={`/clients/${card.id}`} className="block rounded-xl bg-paper px-3 py-3">
                <p className="font-medium">{card.title || "Untitled client"}</p>
                <p className="text-sm text-muted">{[card.area, card.city].filter(Boolean).join(", ") || "Area not set"}</p>
              </Link>
            ))}
            {stats && (stats.recentClients || []).length === 0 ? (
              <p className="text-sm text-muted">No clients yet. A buyer request from WhatsApp, or Add client, will show here.</p>
            ) : null}
          </div>
        </section>
        <section className="mt-4 rounded-2xl border border-line bg-panel p-5">
          <h2 className="font-semibold">WhatsApp</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            {stats?.whatsapp.state === "connected"
              ? `Connected${stats.whatsapp.phone ? ` as ${stats.whatsapp.phone}` : ""}. New messages are picked up on this computer.`
              : "Not connected. Open WhatsApp and scan the code."}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Villas</dt>
              <dd>{stats?.villas ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Apartments</dt>
              <dd>{stats?.apartments ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Messages saved</dt>
              <dd>{stats?.messages ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Waiting to sort</dt>
              <dd>{stats?.pendingSort ?? "—"}</dd>
            </div>
          </dl>
          <Link href="/whatsapp" className="mt-5 inline-block rounded-xl bg-pine px-4 py-2.5 text-sm font-medium text-white">
            {stats?.whatsapp.state === "connected" ? "Connection" : "Link WhatsApp"}
          </Link>
        </section>
        </div>
      </div>
    </div>
  );
}
