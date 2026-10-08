"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { formatPhone } from "@/lib/format";
import type { DeveloperRow, SupplierRow } from "@/lib/types";

type Filter = "all" | "open" | "stock" | "empty";

export default function DevelopersPage() {
  const router = useRouter();
  const [developers, setDevelopers] = useState<DeveloperRow[] | null>(null);
  const [people, setPeople] = useState<SupplierRow[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [name, setName] = useState("");

  async function load() {
    const response = await fetch("/api/suppliers");
    if (!response.ok) return;
    const body = await response.json();
    setDevelopers(body.developers || []);
    setPeople(body.suppliers || []);
  }

  useEffect(() => {
    void load();
  }, []);

  const unassigned = people.filter((person) => !person.company_id);
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    return (developers || []).filter((developer) => {
      if (filter === "stock" && developer.listings < 1) return false;
      if (filter === "empty" && developer.listings > 0) return false;
      if (!needle) return true;
      const staff = people.filter((person) => person.company_id === developer.id);
      return [developer.name, ...staff.flatMap((person) => [person.name, person.phone || ""])].some((value) => value.toLowerCase().includes(needle));
    });
  }, [developers, people, filter, needle]);

  const openPeople = unassigned.filter((person) => !needle || [person.name, person.phone || ""].some((value) => value.toLowerCase().includes(needle)));
  const listingCount = people.reduce((sum, person) => sum + (person.listings || 0), 0);

  async function addDeveloper() {
    if (!name.trim()) return;
    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!response.ok) return;
    const body = await response.json();
    router.push(`/suppliers/${body.id}`);
  }

  const filters: Array<[Filter, string]> = [
    ["all", "All"],
    ["open", "Needs a developer"],
    ["stock", "With listings"],
    ["empty", "No listings"],
  ];

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <Icon name="building" className="h-7 w-7 text-pine" />
            Developers
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">A developer holds every employee who sends stock. Rename them here and the name follows into WhatsApp and each property.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void addDeveloper();
          }}
        >
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="New developer" className="rounded-xl border border-line bg-panel px-3 py-2 text-sm" />
          <button type="submit" className="rounded-xl bg-pine px-4 py-2 text-sm font-medium text-white">Add</button>
        </form>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          ["Developers", developers?.length ?? 0, "building"],
          ["Employees", people.length, "user"],
          ["Unassigned", unassigned.length, "layers"],
          ["Listings", listingCount, "home"],
        ].map(([label, count, icon]) => (
          <article key={String(label)} className="flex items-center gap-3 desk-card rounded-2xl border border-line bg-panel px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-sand text-pine">
              <Icon name={icon as "building"} className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted">{label}</p>
              <p className="text-xl font-semibold">{developers === null ? "…" : count}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2">
          <Icon name="search" className="h-4 w-4 text-muted" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search developer, employee, or phone" className="w-full bg-transparent text-sm outline-none" />
        </label>
        {filters.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full px-3 py-1.5 text-sm ${filter === key ? "bg-pine text-white" : "border border-line bg-panel"}`}>
            {label}
          </button>
        ))}
      </div>

      {filter !== "open" ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((developer) => (
            <Link key={developer.id} href={`/suppliers/${developer.id}`} className="desk-card rounded-2xl border border-line bg-panel p-4 hover:border-leaf">
              <div className="flex items-center gap-3">
                {developer.logo ? (
                  <img src={`/api/media/${developer.logo}`} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-pine text-white">
                    <Icon name="building" className="h-6 w-6" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{developer.name}</p>
                  <p className="text-sm text-muted">{developer.employees} {developer.employees === 1 ? "employee" : "employees"} · {developer.listings} {developer.listings === 1 ? "listing" : "listings"}</p>
                </div>
                <button
                  type="button"
                  title="Delete developer"
                  aria-label="Delete developer"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!window.confirm(`Delete ${developer.name}? Employees stay, without a developer.`)) return;
                    void fetch(`/api/suppliers/${developer.id}`, { method: "DELETE" }).then(() => load());
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-clay hover:bg-sand"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
      {developers && visible.length === 0 && filter !== "open" ? <p className="mt-6 text-sm text-muted">No developers match.</p> : null}

      {filter === "all" || filter === "open" ? (
        <section className="mt-6 desk-card rounded-2xl border border-line bg-panel p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Icon name="user" className="h-4 w-4 text-pine" />
            Needs a developer
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {openPeople.map((person) => (
              <article key={person.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{person.name}</p>
                  <p className="text-sm text-muted">{formatPhone(person.phone) || "No mobile number"}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <WhatsAppLink phone={person.phone} />
                  <Link href={`/properties?supplier=${person.id}`} className="text-sm font-medium text-leaf">{person.listings} listings</Link>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const developerName = String(new FormData(event.currentTarget).get("developer") || "");
                      void fetch(`/api/suppliers/employee/${person.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: person.name, developer: developerName }),
                      }).then(() => load());
                    }}
                  >
                    <select name="developer" defaultValue="" required className="w-40 rounded-xl border border-line bg-panel px-3 py-2 text-sm">
                      <option value="">Choose developer</option>
                      {(developers || []).map((developer) => (
                        <option key={developer.id} value={developer.name}>{developer.name}</option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white">Save</button>
                  </form>
                </div>
              </article>
            ))}
            {openPeople.length === 0 ? <p className="text-sm text-muted">Everyone is filed under a developer.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
