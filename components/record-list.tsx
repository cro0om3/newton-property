"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PropertyCard } from "@/components/property-card";
import { useViewer } from "@/components/shell";
import type { CardRow } from "@/lib/types";

const TYPES = ["villa", "apartment", "land", "office", "warehouse", "townhouse", "building", "other"];

export function RecordList({ kind }: { kind: "listing" | "inquiry" }) {
  const router = useRouter();
  const { viewer } = useViewer();
  const params = useSearchParams();
  const listing = kind === "listing";
  const [propertyType, setPropertyType] = useState(params.get("type") || "");
  const [purpose, setPurpose] = useState(params.get("purpose") || "");
  const [status, setStatus] = useState(params.get("status") || "");
  const [q, setQ] = useState("");
  const supplierId = params.get("supplier") || "";
  const developerId = params.get("developer") || "";
  const [cards, setCards] = useState<CardRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [broker, setBroker] = useState("");
  const [brokers, setBrokers] = useState<string[]>([]);
  const [senderName, setSenderName] = useState("");
  const [formType, setFormType] = useState("");
  const [formPurpose, setFormPurpose] = useState(listing ? "sale" : "buy");

  const query = useMemo(() => {
    const search = new URLSearchParams();
    search.set("kind", kind);
    if (propertyType) search.set("type", propertyType);
    if (purpose) search.set("purpose", purpose);
    if (status) search.set("status", status);
    if (q.trim()) search.set("q", q.trim());
    if (supplierId) search.set("supplier", supplierId);
    if (developerId) search.set("developer", developerId);
    if (viewer) search.set("assignee", viewer);
    return search.toString();
  }, [kind, propertyType, purpose, status, q, supplierId, developerId, viewer]);

  useEffect(() => {
    void fetch("/api/settings")
      .then((response) => response.json())
      .then((body) => {
        const names = Array.isArray(body.settings?.brokers) ? body.settings.brokers : [];
        setBrokers(names);
        setBroker((current) => current || body.settings?.defaultBroker || "");
        setCity((current) => current || body.settings?.defaultCity || "");
      });
  }, []);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch(`/api/cards?${query}`);
      if (!response.ok || stop) return;
      const body = await response.json();
      setCards(body.cards);
    }
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [query]);

  async function createRecord() {
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        title,
        purpose: formPurpose,
        propertyType: formType,
        city,
        area,
        price,
        bedrooms,
        broker,
        senderName,
      }),
    });
    if (!response.ok) return;
    const body = await response.json();
    router.push(listing ? `/properties/${body.id}` : `/clients/${body.id}`);
  }

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{listing ? "Properties" : "Clients"}</h1>
          <p className="mt-2 text-sm text-muted">
            {listing
              ? "Company inventory. WhatsApp listings land here, and brokers can add a unit directly."
              : "Buyers and tenants. WhatsApp requests land here, and brokers can add a client directly."}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl border border-line bg-panel px-4 py-2.5 text-sm font-medium">
            {listing ? "Add property" : "Add client"}
          </button>
          <a href={`/api/reports/excel?${query}`} className="rounded-xl bg-pine px-4 py-2.5 text-sm font-medium text-white">
            Export Excel
          </a>
        </div>
      </div>

      {supplierId || developerId ? (
        <p className="mt-4 text-sm text-muted">
          Showing a filtered list.{" "}
          <Link href={listing ? "/properties" : "/clients"} className="font-medium text-leaf">
            Show all
          </Link>
        </p>
      ) : null}

      {open ? (
        <form
          className="mt-5 grid gap-3 desk-card rounded-2xl border border-line bg-panel p-4 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createRecord();
          }}
        >
          <input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder={listing ? "Property title" : "What they want"} className="rounded-xl border border-line bg-paper px-3 py-2 text-sm md:col-span-2" />
          <input value={senderName} onChange={(event) => setSenderName(event.target.value)} placeholder={listing ? "Owner name" : "Client name"} className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <input value={broker} onChange={(event) => setBroker(event.target.value)} placeholder="Broker" list="desk-brokers" className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <datalist id="desk-brokers">{brokers.map((name) => <option key={name} value={name} />)}</datalist>
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <input value={area} onChange={(event) => setArea(event.target.value)} placeholder="Area" className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <input value={price} onChange={(event) => setPrice(event.target.value)} placeholder={listing ? "Price" : "Budget"} className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <input value={bedrooms} onChange={(event) => setBedrooms(event.target.value)} placeholder="Bedrooms" className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
          <Select value={formType} onChange={setFormType} options={[["", "Type"], ...TYPES.map((type) => [type, type[0].toUpperCase() + type.slice(1)] as [string, string])]} />
          <Select
            value={formPurpose}
            onChange={setFormPurpose}
            options={listing ? [["sale", "For sale"], ["rent", "For rent"]] : [["buy", "Wants to buy"], ["seek_rent", "Wants to rent"]]}
          />
          <button type="submit" className="rounded-xl bg-pine px-4 py-2 text-sm font-medium text-white">
            Save
          </button>
        </form>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2 desk-card rounded-2xl border border-line bg-panel p-3">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder={listing ? "Search location, project, or unit" : "Search client, area, or budget"}
          className="min-w-64 flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm outline-none ring-leaf focus:ring-2"
        />
        <Select value={propertyType} onChange={setPropertyType} options={[["", "All types"], ...TYPES.map((type) => [type, type[0].toUpperCase() + type.slice(1)] as [string, string])]} />
        <Select
          value={purpose}
          onChange={setPurpose}
          options={
            listing
              ? [["", "All purposes"], ["sale", "For sale"], ["rent", "For rent"]]
              : [["", "All purposes"], ["buy", "Wants to buy"], ["seek_rent", "Wants to rent"]]
          }
        />
        <Select
          value={status}
          onChange={setStatus}
          options={[
            ["", "Any stage"],
            ["new", "New"],
            ["contacted", "Contacted"],
            ["viewing", "Viewing"],
            ["offer", "Offer"],
            ["needs_review", "Needs review"],
            ["closed", "Closed"],
          ]}
        />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(cards || []).map((card) => (
          <PropertyCard key={card.id} card={card} onDeleted={() => setCards((current) => (current || []).filter((item) => item.id !== card.id))} />
        ))}
      </div>
      {cards && cards.length === 0 ? <p className="mt-8 text-sm text-muted">Nothing in this list yet.</p> : null}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-line bg-panel px-3 py-2 text-sm">
      {options.map(([optionValue, label]) => (
        <option key={optionValue || label} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
