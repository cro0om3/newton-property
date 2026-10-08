import { getSettings } from "@/lib/settings";
import type { CardRow } from "@/lib/types";

export type MatchHit = {
  card: CardRow;
  score: number;
  reason: string;
};

function norm(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function purposeFits(listing: CardRow, client: CardRow) {
  if (!listing.purpose || !client.purpose) return true;
  if (client.purpose === "buy") return listing.purpose === "sale";
  if (client.purpose === "seek_rent") return listing.purpose === "rent";
  return true;
}

export function matchesFor(card: CardRow, pool: CardRow[]) {
  const hits: MatchHit[] = [];
  for (const other of pool) {
    if (other.id === card.id || other.status === "closed") continue;
    const listing = card.kind === "listing" ? card : other;
    const client = card.kind === "inquiry" ? card : other;
    if (listing.kind !== "listing" || client.kind !== "inquiry") continue;
    const result = scorePair(listing, client);
    if (!result) continue;
    hits.push({ card: other, score: result.score, reason: result.reason });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 6);
}

function scorePair(listing: CardRow, client: CardRow) {
  if (!purposeFits(listing, client)) return null;
  if (listing.property_type && client.property_type && listing.property_type !== client.property_type) return null;
  if (norm(listing.city) && norm(client.city) && norm(listing.city) !== norm(client.city)) return null;
  if (client.bedrooms === 0 && listing.bedrooms != null && listing.bedrooms !== 0) return null;
  if (client.bedrooms != null && listing.bedrooms != null && listing.bedrooms < client.bedrooms) return null;
  const slack = 1 + getSettings().budgetPercent / 100;
  if (client.price != null && listing.price != null && listing.price > client.price * slack) return null;

  let score = 20;
  const reasons: string[] = [];
  if (listing.property_type && listing.property_type === client.property_type) {
    score += 25;
    reasons.push("Same type");
  }
  if (norm(listing.city) && norm(listing.city) === norm(client.city)) {
    score += 15;
    reasons.push(listing.city || "Same city");
  }
  const listingArea = norm(listing.area);
  const clientArea = norm(client.area);
  if (listingArea && clientArea && (listingArea.includes(clientArea) || clientArea.includes(listingArea))) {
    score += 20;
    reasons.push(listing.area || "Same area");
  }
  if (listing.bedrooms != null && client.bedrooms != null && listing.bedrooms === client.bedrooms) {
    score += 15;
    reasons.push(client.bedrooms === 0 ? "Studio" : client.bedrooms === 1 ? "1 bed" : `${client.bedrooms} beds`);
  }
  if (client.price != null && listing.price != null && listing.price <= client.price) {
    score += 15;
    reasons.push("Within budget");
  }
  if (score < 35) return null;
  return { score, reason: reasons.join(" · ") || "Possible fit" };
}
