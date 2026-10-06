"use client";

import { useState } from "react";
import type { CardExtra, CardRow, SupplierRow } from "@/lib/types";

function extraOf(card: CardRow): CardExtra {
  try {
    return card.extra ? (JSON.parse(card.extra) as CardExtra) : {};
  } catch {
    return {};
  }
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2" />
    </label>
  );
}

export function DetailsForm({ card, supplier, onSaved }: { card: CardRow; supplier: SupplierRow | null; onSaved: () => void }) {
  const extra = extraOf(card);
  const land = card.property_type === "land";
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: card.title || "",
    city: card.city || "",
    area: card.area || "",
    price: card.price == null ? "" : String(card.price),
    bedrooms: card.bedrooms == null ? "" : String(card.bedrooms),
    bathrooms: card.bathrooms == null ? "" : String(card.bathrooms),
    size: card.size_sqm == null ? "" : String(card.size_sqm),
    handover: extra.handover || "",
    planLabel: extra.planLabel || "",
    floor: extra.floor || "",
    unit: extra.unit || "",
    parking: extra.parking || "",
    view: extra.view || "",
    plot: extra.plot || "",
    supplierName: supplier?.name || card.sender_name || "",
    companyName: supplier?.company_name || "",
  });

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setBusy(true);
    const number = (value: string) => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    await fetch(`/api/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierName: form.supplierName,
        companyName: form.companyName,
        details: {
          title: form.title,
          city: form.city || null,
          area: form.area || null,
          price: number(form.price),
          bedrooms: land ? null : number(form.bedrooms),
          bathrooms: land ? null : number(form.bathrooms),
          sizeSqm: number(form.size),
          extra: {
            handover: form.handover || null,
            planLabel: form.planLabel || null,
            floor: form.floor || null,
            unit: form.unit || null,
            parking: form.parking || null,
            view: form.view || null,
            plot: form.plot || null,
          },
        },
      }),
    });
    setBusy(false);
    setOpen(false);
    onSaved();
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Missing details</h2>
          <p className="text-sm text-muted">Fill anything WhatsApp did not include. Empty fields stay N/A.</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border border-line px-4 py-2 text-sm">
          {open ? "Close" : "Edit"}
        </button>
      </div>
      {open ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Title" value={form.title} onChange={(value) => set("title", value)} />
          <Field label="Price (AED)" value={form.price} onChange={(value) => set("price", value)} />
          <Field label="City" value={form.city} onChange={(value) => set("city", value)} />
          <Field label="Area" value={form.area} onChange={(value) => set("area", value)} />
          {land ? null : <Field label="Bedrooms" value={form.bedrooms} onChange={(value) => set("bedrooms", value)} />}
          {land ? null : <Field label="Bathrooms" value={form.bathrooms} onChange={(value) => set("bathrooms", value)} />}
          <Field label={land ? "Plot (sqm)" : "Size (sqm)"} value={form.size} onChange={(value) => set("size", value)} />
          <Field label="Handover" value={form.handover} onChange={(value) => set("handover", value)} />
          <Field label="Payment plan" value={form.planLabel} onChange={(value) => set("planLabel", value)} />
          {land ? null : <Field label="Floor" value={form.floor} onChange={(value) => set("floor", value)} />}
          {land ? null : <Field label="Unit" value={form.unit} onChange={(value) => set("unit", value)} />}
          <Field label="Parking" value={form.parking} onChange={(value) => set("parking", value)} />
          <Field label="View" value={form.view} onChange={(value) => set("view", value)} />
          <Field label="Plot size" value={form.plot} onChange={(value) => set("plot", value)} />
          <Field label={card.kind === "inquiry" ? "Client name" : "Supplier name"} value={form.supplierName} onChange={(value) => set("supplierName", value)} />
          <Field label="Company" value={form.companyName} onChange={(value) => set("companyName", value)} />
          <div className="sm:col-span-2">
            <button type="button" disabled={busy || !form.title.trim() || !form.supplierName.trim()} onClick={save} className="rounded-full bg-pine px-4 py-2 text-sm text-white disabled:opacity-50">
              {busy ? "Saving..." : "Save details"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
