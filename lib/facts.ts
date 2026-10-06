import type { IconName } from "@/components/icons";
import { formatPhone, formatPrice, formatRooms, propertyLabel, purposeLabel } from "@/lib/format";
import type { CardExtra, CardRow } from "@/lib/types";

export const NA = "N/A";

export type Fact = {
  key: string;
  label: string;
  value: string;
  icon: IconName;
  empty: boolean;
};

function shown(value: string | number | null | undefined): { value: string; empty: boolean } {
  if (value == null || value === "" || value === "—") return { value: NA, empty: true };
  return { value: String(value), empty: false };
}

function readExtra(raw: string | null): CardExtra {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CardExtra;
  } catch {
    return {};
  }
}

function fact(key: string, label: string, icon: IconName, raw: string | number | null | undefined): Fact {
  const next = shown(raw);
  return { key, label, icon, ...next };
}

export function propertyFacts(card: CardRow): Fact[] {
  const extra = readExtra(card.extra);
  const type = card.property_type || "other";
  const size = card.size_sqm ? `${card.size_sqm} sqm` : null;
  const furnished = extra.furnished == null ? null : extra.furnished ? "Yes" : "No";
  const rooms = card.bedrooms == null ? null : formatRooms(card.bedrooms);

  const fields: Record<string, Fact> = {
    bedrooms: fact("bedrooms", "Bedrooms", "bed", rooms === "—" ? null : rooms),
    bathrooms: fact("bathrooms", "Bathrooms", "bath", card.bathrooms),
    size: fact("size", type === "villa" || type === "townhouse" ? "Built-up" : "Size", "size", size),
    plot: fact("plot", type === "land" ? "Plot size" : "Plot", "land", type === "land" ? size : extra.plot),
    floor: fact("floor", "Floor", "building", extra.floor),
    unit: fact("unit", "Unit", "tag", extra.unit),
    parking: fact("parking", "Parking", "car", extra.parking),
    view: fact("view", "View", "eye", extra.view),
    furnished: fact("furnished", "Furnished", "sofa", furnished),
    handover: fact("handover", "Handover", "calendar", extra.handover),
  };

  const keys =
    type === "land"
      ? ["plot"]
      : type === "villa" || type === "townhouse"
        ? ["bedrooms", "bathrooms", "plot", "size", "parking", "view", "furnished"]
        : type === "office" || type === "warehouse"
          ? ["size", "floor", "parking", "furnished"]
          : ["bedrooms", "bathrooms", "size", "floor", "unit", "parking", "view", "furnished", "handover"];

  return keys.map((key) => fields[key]);
}

export function dealFacts(card: CardRow): Fact[] {
  const extra = readExtra(card.extra);
  const plans = (extra.plans || []).filter((plan) => plan.price);
  const lowest = plans.length ? Math.min(...plans.map((plan) => plan.discountedPrice || plan.price)) : card.price;
  const place = [card.area, card.city].filter(Boolean).join(", ");
  return [
    fact("type", "Type", card.property_type === "land" ? "land" : card.property_type === "villa" ? "home" : "building", propertyLabel(card.property_type)),
    fact("purpose", "Purpose", "tag", purposeLabel(card.purpose)),
    fact("area", "Area", "pin", place),
    fact("price", plans.length > 1 ? "From" : "Price", "layers", lowest == null ? null : formatPrice(lowest, card.currency)),
    fact("sender", "Sender", "chat", card.sender_name),
    fact("phone", "Phone", "phone", formatPhone(card.sender_phone) === "—" ? null : formatPhone(card.sender_phone)),
    fact("reference", "Reference", "file", extra.reference),
  ];
}

export function cardSlots(card: CardRow): Fact[] {
  const facts = propertyFacts(card);
  const wanted = card.property_type === "land" ? ["plot"] : ["bedrooms", "bathrooms", "size"];
  return wanted.map((key) => facts.find((item) => item.key === key)).filter((item): item is Fact => Boolean(item));
}
