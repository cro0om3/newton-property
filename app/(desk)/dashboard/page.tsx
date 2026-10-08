"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon, IconBadge, type IconName } from "@/components/icons";
import { PropertyCard } from "@/components/property-card";
import { deskZone } from "@/lib/format";
import type { WaStatus } from "@/lib/status";
import type { CardRow } from "@/lib/types";

type Alert = { id: string; title: string; body: string; href: string };
type FollowUp = { id: string; kind: string; title: string | null; next_follow_up: number };

type Stats = {
  newToday: number;
  listings: number;
  inquiries: number;
  needsReview: number;
  villas: number;
  apartments: number;
  land: number;
  pendingSort: number;
  messages: number;
  recent: CardRow[];
  recentClients: CardRow[];
  viewings: number;
  offers: number;
  fresh: number;
  contacted: number;
  unassigned: number;
  followUps: number;
  followUpCards: FollowUp[];
  alerts: Alert[];
  whatsapp: WaStatus;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch("/api/stats");
      if (!response.ok || stop) return;
      const body = await response.json();
      setStats({
        ...body,
        alerts: body.alerts || [],
        followUpCards: body.followUpCards || [],
        recent: body.recent || [],
        recentClients: body.recentClients || [],
        whatsapp: body.whatsapp || { state: "offline", phone: null, openai: false, lastError: null, qrDataUrl: null, model: "", updatedAt: 0 },
      });
    }
    void load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: deskZone(),
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const cards: Array<{ label: string; hint: string; value: number | string; href: string; icon: IconName }> = [
    { label: "Properties", hint: "Still on the desk", value: stats?.listings ?? "—", href: "/properties", icon: "building" },
    { label: "Clients", hint: "Open buyers", value: stats?.inquiries ?? "—", href: "/clients", icon: "user" },
    { label: "Viewings", hint: "Booked now", value: stats?.viewings ?? "—", href: "/properties?status=viewing", icon: "calendar" },
    { label: "Due today", hint: "Follow-ups", value: stats?.followUps ?? "—", href: "#follow-ups", icon: "check" },
  ];

  const pipeline = [
    { label: "New", value: stats?.fresh ?? 0, href: "/properties?status=new" },
    { label: "Contacted", value: stats?.contacted ?? 0, href: "/properties?status=contacted" },
    { label: "Viewing", value: stats?.viewings ?? 0, href: "/properties?status=viewing" },
    { label: "Offer", value: stats?.offers ?? 0, href: "/properties?status=offer" },
  ];
  const pipelineMax = Math.max(1, ...pipeline.map((step) => step.value));

  const stock = [
    { label: "Villas", value: stats?.villas ?? 0 },
    { label: "Apartments", value: stats?.apartments ?? 0 },
    { label: "Land", value: stats?.land ?? 0 },
  ];
  const stockMax = Math.max(1, ...stock.map((row) => row.value));
  const connected = stats?.whatsapp?.state === "connected";

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted" suppressHydrationWarning>{today}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Desk overview</h1>
          <p className="mt-1 text-sm text-muted">
            {stats ? `${stats.newToday} new today · ${stats.messages} messages saved` : "Loading the desk"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/properties" className="rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white">
            Properties
          </Link>
          <Link href="/clients" className="rounded-xl border border-line bg-panel px-3 py-2 text-sm font-medium">
            Clients
          </Link>
          <Link href="/inbox" className="rounded-xl border border-line bg-panel px-3 py-2 text-sm font-medium">
            WhatsApp
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="desk-card flex items-start justify-between rounded-2xl border border-line bg-panel px-4 py-4">
            <div>
              <p className="text-sm text-muted">{card.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-pine">{card.value}</p>
              <p className="mt-1 text-xs text-muted">{card.hint}</p>
            </div>
            <IconBadge name={card.icon} />
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="desk-card rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Pipeline</h2>
            <Link href="/properties" className="text-sm font-medium text-leaf">
              Open properties
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {pipeline.map((step) => (
              <Link key={step.label} href={step.href} className="rounded-xl bg-paper px-3 py-3">
                <p className="text-2xl font-semibold text-pine">{stats ? step.value : "—"}</p>
                <p className="text-xs text-muted">{step.label}</p>
                <span className="mt-3 block h-1 overflow-hidden rounded-full bg-sand">
                  <span className="block h-1 rounded-full bg-pine" style={{ width: `${Math.round((step.value / pipelineMax) * 100)}%` }} />
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-5">
            <h3 className="text-sm font-semibold">Stock</h3>
            <div className="mt-3 space-y-3">
              {stock.map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">{row.label}</span>
                    <span className="font-medium">{stats ? row.value : "—"}</span>
                  </div>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sand">
                    <span className="block h-1.5 rounded-full bg-leaf" style={{ width: `${Math.round((row.value / stockMax) * 100)}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="desk-card rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Needs attention</h2>
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${connected ? "text-leaf" : "text-muted"}`}>
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-400"}`} />
              {connected ? "WhatsApp live" : "WhatsApp offline"}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {(stats?.alerts || []).slice(0, 5).map((alert) => (
              <Link key={alert.id} href={alert.href} className="block rounded-xl bg-paper px-3 py-3">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted">{alert.body}</p>
              </Link>
            ))}
            {stats && (stats.alerts || []).length === 0 ? <p className="text-sm text-muted">Nothing is waiting. The desk is clear.</p> : null}
          </div>
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-center justify-between">
              <h3 id="follow-ups" className="text-sm font-semibold">Follow-ups due</h3>
              <span className="text-xs text-muted">{stats?.followUps ?? 0}</span>
            </div>
            <div className="mt-3 space-y-2">
              {(stats?.followUpCards || []).map((row) => (
                <Link key={row.id} href={row.kind === "inquiry" ? `/clients/${row.id}` : `/properties/${row.id}`} className="flex items-center gap-2 text-sm">
                  <Icon name="calendar" className="h-4 w-4 text-pine" />
                  <span className="min-w-0 truncate">{row.title || "Untitled"}</span>
                </Link>
              ))}
              {stats && (stats.followUpCards || []).length === 0 ? <p className="text-sm text-muted">No follow-up is due today.</p> : null}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="desk-card rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Latest properties</h2>
            <Link href="/properties" className="text-sm font-medium text-leaf">
              View all
            </Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {(stats?.recent || []).map((card) => (
              <PropertyCard key={card.id} card={card} onDeleted={() => setStats((current) => current ? { ...current, recent: current.recent.filter((item) => item.id !== card.id) } : current)} />
            ))}
            {stats && (stats.recent || []).length === 0 ? (
              <p className="text-sm text-muted">No properties yet. A listing from WhatsApp, or a manual property, will show here.</p>
            ) : null}
          </div>
        </section>
        <section className="desk-card rounded-2xl border border-line bg-panel p-5">
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
              <p className="text-sm text-muted">No clients yet. A buyer request from WhatsApp will show here.</p>
            ) : null}
          </div>
          <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">No broker yet</dt>
              <dd className="font-medium">{stats?.unassigned ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Waiting to sort</dt>
              <dd className="font-medium">{stats?.pendingSort ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Needs review</dt>
              <dd className="font-medium">{stats?.needsReview ?? "—"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
