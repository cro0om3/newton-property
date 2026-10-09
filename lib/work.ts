import { dueFollowUps, listCards } from "./db";
import { missingLabels } from "./facts";
import { getSettings } from "./settings";
import { zonedDayRange } from "./time";
export type WorkItem = {
  id: string;
  href: string;
  action: "Call" | "Decide" | "Send";
  title: string;
  detail: string;
};

function hrefFor(card: { id: string; kind: string }) {
  return card.kind === "inquiry" ? `/clients/${card.id}` : `/properties/${card.id}`;
}

export function todayWork(broker = ""): WorkItem[] {
  const items: WorkItem[] = [];
  for (const row of dueFollowUps(3, broker)) {
    items.push({
      id: `call-${row.id}`,
      href: hrefFor(row),
      action: "Call",
      title: row.title || "Untitled",
      detail: "A follow-up is due today.",
    });
  }
  const cards = listCards({ broker: broker || undefined, limit: 300 }).filter((card) => card.status !== "closed");
  const review = cards.filter((card) => card.status === "needs_review");
  if (review.length === 1) {
    items.push({
      id: `decide-${review[0].id}`,
      href: hrefFor(review[0]),
      action: "Decide",
      title: review[0].title || "Untitled",
      detail: "Price or details are still unconfirmed.",
    });
  } else if (review.length > 1) {
    items.push({
      id: "decide-all",
      href: "/review",
      action: "Decide",
      title: `${review.length} records need a decision`,
      detail: "Open Review and confirm them there. They stay out of the approved list until then.",
    });
  }
  for (const card of cards.filter((card) => card.status !== "needs_review" && missingLabels(card).length).slice(0, 3)) {
    items.push({
      id: `send-${card.id}`,
      href: hrefFor(card),
      action: "Send",
      title: card.title || "Untitled",
      detail: "A reply asking for the missing details is ready.",
    });
  }
  return items;
}

export function officeLate() {
  const cards = listCards({ limit: 300 }).filter((card) => card.status !== "closed");
  const end = zonedDayRange(getSettings().timezone).end;
  const names = [...new Set(cards.map((card) => card.broker).filter((name): name is string => Boolean(name)))];
  return names
    .map((name) => {
      const mine = cards.filter((card) => card.broker === name);
      return {
        name,
        offers: mine.filter((card) => card.status === "offer").length,
        overdue: mine.filter((card) => card.next_follow_up != null && card.next_follow_up <= end).length,
        review: mine.filter((card) => card.status === "needs_review").length,
      };
    })
    .filter((row) => row.offers || row.overdue || row.review);
}
