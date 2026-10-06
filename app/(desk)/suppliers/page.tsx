"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { formatPhone } from "@/lib/format";
import type { SupplierRow } from "@/lib/types";

export default function SuppliersPage() {
  const [rows, setRows] = useState<SupplierRow[] | null>(null);

  useEffect(() => {
    void fetch("/api/suppliers")
      .then((response) => response.json())
      .then((body) => setRows(body.suppliers || []));
  }, []);

  const groups = new Map<string, SupplierRow[]>();
  for (const row of rows || []) {
    const key = row.company_name || "No company yet";
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <h1 className="text-3xl font-semibold tracking-tight">Suppliers</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Each person who sends a listing stays on their own card. Assign a company on the property page, then every listing from that person sits under the company too.
      </p>
      {rows === null ? <p className="mt-6 text-sm text-muted">Loading...</p> : null}
      {rows && rows.length === 0 ? <p className="mt-6 text-sm text-muted">No suppliers yet. Open a property that came from WhatsApp.</p> : null}
      <div className="mt-6 space-y-5">
        {[...groups.entries()].map(([company, people]) => (
          <section key={company} className="rounded-2xl border border-line bg-panel p-5">
            <h2 className="font-semibold">{company}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {people.map((person) => (
                <article key={person.id} className="rounded-2xl border border-line bg-paper p-4">
                  <p className="font-medium">{person.name}</p>
                  <p className="mt-1 text-sm text-muted">{formatPhone(person.phone) || "No mobile number"}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <WhatsAppLink phone={person.phone} />
                    <Link href={`/properties?supplier=${person.id}`} className="text-sm font-medium text-leaf">
                      {person.listings} {person.listings === 1 ? "listing" : "listings"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
