"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
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

export function DetailsForm({ card, supplier, onSaved, openSignal = 0 }: { card: CardRow; supplier: SupplierRow | null; onSaved: () => void; openSignal?: number }) {
  const extra = extraOf(card);
  const type = card.property_type;
  const land = type === "land";
  const villa = type === "villa" || type === "townhouse";
  const office = type === "office";
  const warehouse = type === "warehouse";
  const building = type === "building";
  const rooms = type === "apartment" || villa || !type;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [developers, setDevelopers] = useState<string[]>([]);
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
    furnished: extra.furnished == null ? "" : extra.furnished ? "yes" : "no",
    maid: extra.maid == null ? "" : extra.maid ? "yes" : "no",
    storeys: extra.storeys || "",
    unitCount: extra.unitCount || "",
    supplierName: supplier?.name || card.sender_name || "",
    companyName: supplier?.company_name || "",
  });

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  useEffect(() => {
    void fetch("/api/suppliers")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!body) return;
        setDevelopers((body.developers || []).map((item: { name: string }) => item.name));
      });
  }, []);

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
          bedrooms: rooms ? number(form.bedrooms) : undefined,
          bathrooms: rooms ? number(form.bathrooms) : undefined,
          sizeSqm: number(form.size),
          extra: {
            handover: rooms ? form.handover || null : extra.handover,
            planLabel: form.planLabel || null,
            floor: type === "apartment" || office ? form.floor || null : extra.floor,
            unit: type === "apartment" || !type ? form.unit || null : extra.unit,
            parking: form.parking || null,
            view: rooms ? form.view || null : extra.view,
            plot: land || villa || building ? form.plot || null : extra.plot,
            furnished: office ? (form.furnished === "" ? null : form.furnished === "yes") : extra.furnished,
            maid: rooms ? (form.maid === "" ? null : form.maid === "yes") : extra.maid,
            storeys: building ? form.storeys || null : extra.storeys,
            unitCount: building ? form.unitCount || null : extra.unitCount,
          },
        },
      }),
    });
    setBusy(false);
    setOpen(false);
    onSaved();
  }

  return (
    <section className="mt-6 desk-card rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Missing details</h2>
          <p className="text-sm text-muted">Fill anything WhatsApp did not include. Empty fields stay N/A.</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} title={open ? "Close" : "Edit"} aria-label={open ? "Close" : "Edit"} className="grid h-8 w-8 place-items-center rounded-full border border-line text-pine hover:bg-sand">
          <Icon name="pencil" className="h-3.5 w-3.5" />
        </button>
      </div>
      {open ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Title" value={form.title} onChange={(value) => set("title", value)} />
          <Field label="Price (AED)" value={form.price} onChange={(value) => set("price", value)} />
          <Field label="City" value={form.city} onChange={(value) => set("city", value)} />
          <Field label="Area" value={form.area} onChange={(value) => set("area", value)} />
          {rooms ? <Field label="Bedrooms" value={form.bedrooms} onChange={(value) => set("bedrooms", value)} /> : null}
          {rooms ? <Field label="Bathrooms" value={form.bathrooms} onChange={(value) => set("bathrooms", value)} /> : null}
          {rooms ? (
            <label className="block text-sm">
              <span className="text-muted">Maid's room</span>
              <select value={form.maid} onChange={(event) => set("maid", event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2">
                <option value="">Not stated</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          ) : null}
          <Field label={land ? "Plot (sqm)" : villa || building ? "Built-up (sqm)" : "Size (sqm)"} value={form.size} onChange={(value) => set("size", value)} />
          {land || villa || building ? <Field label="Plot size" value={form.plot} onChange={(value) => set("plot", value)} /> : null}
          {rooms ? <Field label="Handover" value={form.handover} onChange={(value) => set("handover", value)} /> : null}
          <Field label="Payment plan" value={form.planLabel} onChange={(value) => set("planLabel", value)} />
          {type === "apartment" || office ? <Field label="Floor" value={form.floor} onChange={(value) => set("floor", value)} /> : null}
          {type === "apartment" || !type ? <Field label="Unit" value={form.unit} onChange={(value) => set("unit", value)} /> : null}
          {building ? <Field label="Number of floors" value={form.storeys} onChange={(value) => set("storeys", value)} /> : null}
          {building ? <Field label="Number of units" value={form.unitCount} onChange={(value) => set("unitCount", value)} /> : null}
          {warehouse || land ? null : <Field label="Parking" value={form.parking} onChange={(value) => set("parking", value)} />}
          {rooms ? <Field label="View" value={form.view} onChange={(value) => set("view", value)} /> : null}
          {office ? (
            <label className="block text-sm">
              <span className="text-muted">Furnished</span>
              <select value={form.furnished} onChange={(event) => set("furnished", event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2">
                <option value="">Not stated</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>
          ) : null}
          <Field label={card.kind === "inquiry" ? "Client name" : "Employee"} value={form.supplierName} onChange={(value) => set("supplierName", value)} />
          <label className="block text-sm">
            <span className="text-muted">Developer</span>
            <select value={form.companyName} onChange={(event) => set("companyName", event.target.value)} className="mt-1 w-full rounded-xl border border-line bg-panel px-3 py-2">
              <option value="">No developer yet</option>
              {form.companyName && !developers.includes(form.companyName) ? <option value={form.companyName}>{form.companyName}</option> : null}
              {developers.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
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
