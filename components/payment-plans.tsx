"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";
import type { PaymentPlan } from "@/lib/types";

export function PaymentPlans({ plans }: { plans: PaymentPlan[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!plans.length) return null;
  const selected = plans.find((plan) => plan.name === open) || null;

  return (
    <section className="mt-6">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-semibold">Payment plans</h2>
        <p className="text-sm text-muted">Open one plan at a time</p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {plans.map((plan) => {
          const active = open === plan.name;
          return (
            <button
              key={plan.name}
              type="button"
              onClick={() => setOpen(active ? null : plan.name)}
              className={`rounded-2xl border px-4 py-3 text-left ${active ? "border-leaf bg-sand" : "border-line bg-panel"}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-leaf">{plan.name}</span>
                <span className="text-xs text-muted">{active ? "Hide" : "View"}</span>
              </span>
              <span className="mt-1 block text-xl font-semibold">
                {formatPrice(plan.discountedPrice || plan.price, "AED")}
              </span>
              {plan.discountedPrice ? (
                <span className="mt-1 block text-xs text-muted">Was {formatPrice(plan.price, "AED")}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {selected ? (
        <article className="mt-3 rounded-2xl border border-line bg-panel p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            {selected.dldFee != null ? <p>DLD 4% {formatPrice(selected.dldFee, "AED", 2)}</p> : null}
            {selected.adminFee != null ? <p>Admin {formatPrice(selected.adminFee, "AED", 2)}</p> : null}
          </div>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-2 font-medium">Payment</th>
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {selected.rows.map((row) => (
                <tr key={`${selected.name}-${row.label}`} className="border-t border-line">
                  <td className="py-2 pr-3">
                    {row.label}
                    {row.percent ? <span className="ml-2 text-xs text-muted">{row.percent}</span> : null}
                  </td>
                  <td className="py-2 whitespace-nowrap">{row.date || "—"}</td>
                  <td className="py-2 text-right whitespace-nowrap">{formatPrice(row.amount, "AED", 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}
    </section>
  );
}
