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
    size: fact("size", type === "villa" || type === "townhouse" || type === "building" ? "Built-up" : "Size", "size", size),
    plot: fact("plot", type === "land" ? "Plot size" : "Plot", "land", type === "land" ? size : extra.plot),
    floor: fact("floor", "Floor", "building", extra.floor),
    unit: fact("unit", "Unit", "tag", extra.unit),
    parking: fact("parking", "Parking", "car", extra.parking),
    view: fact("view", "View", "eye", extra.view),
    furnished: fact("furnished", "Furnished", "sofa", furnished),
    maid: fact("maid", "Maid's room", "home", extra.maid == null ? null : extra.maid ? "Yes" : "No"),
    handover: fact("handover", "Handover", "calendar", extra.handover),
    storeys: fact("storeys", "Floors", "building", extra.storeys),
    units: fact("units", "Units", "tag", extra.unitCount),
  };

  const keys =
    type === "land"
      ? ["plot"]
      : type === "villa" || type === "townhouse"
        ? ["bedrooms", "bathrooms", "maid", "plot", "size", "parking", "view", "furnished"]
        : type === "office"
          ? ["size", "floor", "parking", "furnished"]
          : type === "warehouse"
            ? ["size"]
            : type === "building"
              ? ["plot", "size", "storeys", "units", "parking"]
              : ["bedrooms", "bathrooms", "maid", "size", "floor", "unit", "parking", "view", "furnished", "handover"];

  return keys.map((key) => fields[key]);
}

export function reviewReasons(card: CardRow) {
  const extra = readExtra(card.extra);
  const reasons: string[] = [];
  if (card.price == null) reasons.push(`No price is printed for this ${recordName(card.property_type)}.`);
  if (!card.city && !card.area) reasons.push("City and area are missing.");
  const rooms = card.property_type === "apartment" || card.property_type === "villa" || card.property_type === "townhouse" || !card.property_type;
  if (rooms && (extra.maid != null || (card.bathrooms != null && /floor plan/i.test(card.summary || "")))) {
    const baths = card.bathrooms == null ? "The bathrooms" : `${card.bathrooms} bathroom${card.bathrooms === 1 ? "" : "s"}`;
    const maid = extra.maid ? " and a maid's room" : "";
    reasons.push(`${baths}${maid} were counted from labeled rooms on the floor plan.`);
  }
  if (!reasons.length && card.status === "needs_review") reasons.push("A person needs to confirm this record before it is approved.");
  return reasons;
}

const GAP_WORDS: Record<string, { en: string; ar: string }> = {
  price: { en: "Price", ar: "السعر" },
  bedrooms: { en: "Bedrooms", ar: "عدد الغرف" },
  bathrooms: { en: "Bathrooms", ar: "عدد الحمامات" },
  size: { en: "Size", ar: "المساحة" },
  built: { en: "Built-up area", ar: "مساحة البناء" },
  handover: { en: "Handover date", ar: "تاريخ التسليم" },
  location: { en: "Location", ar: "الموقع" },
  floor: { en: "Floor", ar: "الطابق" },
  unit: { en: "Unit number", ar: "رقم الوحدة" },
  plot: { en: "Plot size", ar: "مساحة الأرض" },
  parking: { en: "Parking", ar: "المواقف" },
  furnished: { en: "Furnished or not", ar: "مفروش أو لا" },
  maid: { en: "Maid's room", ar: "غرفة الخادمة" },
  storeys: { en: "Number of floors", ar: "عدد الطوابق" },
  units: { en: "Number of units", ar: "عدد الوحدات" },
};

function recordName(type: string | null) {
  if (type === "land") return "plot";
  if (type === "building") return "building";
  if (type === "office") return "office";
  if (type === "warehouse") return "warehouse";
  if (type === "villa" || type === "townhouse") return "villa";
  return "unit";
}

function profile(type: string | null) {
  if (type === "villa" || type === "townhouse") return "villa";
  if (type === "land" || type === "office" || type === "warehouse" || type === "building" || type === "apartment") return type;
  return "other";
}

export function missingLabels(card: CardRow) {
  const extra = readExtra(card.extra);
  const kind = profile(card.property_type);
  const labels: string[] = [];
  const price = () => {
    if (card.price == null) labels.push("price");
  };
  const location = () => {
    if (!card.city && !card.area) labels.push("location");
  };
  const size = (key: "size" | "built" = "size") => {
    if (card.size_sqm == null) labels.push(key);
  };
  if (kind === "land") {
    if (!extra.plot && card.size_sqm == null) labels.push("plot");
    location();
    price();
    return labels;
  }
  if (kind === "warehouse") {
    size();
    location();
    price();
    return labels;
  }
  if (kind === "office") {
    size();
    if (!extra.floor) labels.push("floor");
    if (!extra.parking) labels.push("parking");
    if (extra.furnished == null) labels.push("furnished");
    location();
    price();
    return labels;
  }
  if (kind === "building") {
    if (!extra.plot) labels.push("plot");
    size("built");
    if (!extra.storeys) labels.push("storeys");
    if (!extra.unitCount) labels.push("units");
    location();
    price();
    return labels;
  }
  if (kind === "villa") {
    if (card.bedrooms == null) labels.push("bedrooms");
    if (card.bathrooms == null) labels.push("bathrooms");
    if (extra.maid == null) labels.push("maid");
    if (!extra.plot) labels.push("plot");
    size("built");
    if (!extra.parking) labels.push("parking");
    location();
    if (!extra.handover) labels.push("handover");
    price();
    return labels;
  }
  if (kind === "apartment") {
    if (card.bedrooms == null) labels.push("bedrooms");
    if (card.bathrooms == null) labels.push("bathrooms");
    if (extra.maid == null) labels.push("maid");
    size();
    if (!extra.floor) labels.push("floor");
    if (!extra.unit && !/\d{3,6}/.test(card.title || "")) labels.push("unit");
    location();
    if (!extra.handover) labels.push("handover");
    price();
    return labels;
  }
  size();
  location();
  price();
  return labels;
}

function areaLine(sqm: number, arabic: boolean, label: "size" | "built" | "plot") {
  const sqft = Math.round((sqm / 0.092903) * 100) / 100;
  const feet = sqft.toLocaleString("en-US");
  const name = label === "built" ? (arabic ? "مساحة البناء" : "Built-up") : label === "plot" ? (arabic ? "مساحة الأرض" : "Plot") : arabic ? "المساحة" : "Size";
  return arabic ? `${name}: ${sqm} متر (${feet} قدم)` : `${name}: ${sqm} sqm (${feet} sq ft)`;
}

function knownLines(card: CardRow, arabic: boolean) {
  const extra = readExtra(card.extra);
  const kind = profile(card.property_type);
  const lines: string[] = [];
  if (extra.planLabel) lines.push(arabic ? `النوع: ${extra.planLabel}` : `Type ${extra.planLabel}`);
  else if (card.property_type) lines.push(arabic ? `النوع: ${propertyLabel(card.property_type)}` : propertyLabel(card.property_type));
  const rooms = kind === "apartment" || kind === "villa";
  if (rooms && card.bedrooms != null) {
    lines.push(card.bedrooms === 0 ? (arabic ? "استوديو" : "Studio") : arabic ? `${card.bedrooms} غرف` : `${card.bedrooms} bedroom${card.bedrooms === 1 ? "" : "s"}`);
  }
  if (rooms && card.bathrooms != null) lines.push(arabic ? `${card.bathrooms} حمام` : `${card.bathrooms} bathroom${card.bathrooms === 1 ? "" : "s"}`);
  if (rooms && extra.maid) lines.push(arabic ? "غرفة خادمة" : "Maid's room");
  if (rooms && /powder/i.test(card.summary || "")) lines.push(arabic ? "غرفة بودرة" : "Powder room");
  if (card.size_sqm != null) lines.push(areaLine(card.size_sqm, arabic, kind === "land" ? "plot" : kind === "villa" || kind === "building" ? "built" : "size"));
  if ((kind === "villa" || kind === "building") && extra.plot) lines.push(arabic ? `مساحة الأرض: ${extra.plot}` : `Plot: ${extra.plot}`);
  if (kind === "land" && extra.plot && card.size_sqm == null) lines.push(arabic ? `مساحة الأرض: ${extra.plot}` : `Plot: ${extra.plot}`);
  if ((kind === "apartment" || kind === "office") && extra.floor) lines.push(arabic ? `الطابق: ${extra.floor}` : `Floor ${extra.floor}`);
  if (kind === "apartment" && extra.unit) lines.push(arabic ? `الوحدة: ${extra.unit}` : `Unit ${extra.unit}`);
  if ((kind === "villa" || kind === "office" || kind === "apartment") && extra.parking) lines.push(arabic ? `المواقف: ${extra.parking}` : `Parking: ${extra.parking}`);
  if (kind === "office" && extra.furnished != null) lines.push(extra.furnished ? (arabic ? "مفروش" : "Furnished") : arabic ? "غير مفروش" : "Unfurnished");
  if (kind === "building" && extra.storeys) lines.push(arabic ? `عدد الطوابق: ${extra.storeys}` : `${extra.storeys} floors`);
  if (kind === "building" && extra.unitCount) lines.push(arabic ? `عدد الوحدات: ${extra.unitCount}` : `${extra.unitCount} units`);
  const place = [card.area, card.city].filter(Boolean).join(arabic ? "، " : ", ");
  if (place) lines.push(place);
  if (card.price != null) lines.push(arabic ? `السعر: ${formatPrice(card.price, card.currency)}` : formatPrice(card.price, card.currency));
  if ((kind === "apartment" || kind === "villa") && extra.handover) lines.push(arabic ? `التسليم: ${extra.handover}` : `Handover: ${extra.handover}`);
  return lines;
}

export function stockNote(card: CardRow) {
  const extra = readExtra(card.extra);
  if (extra.offSheet) return "Not on the latest sheet";
  const last = extra.priceLog?.at(-1);
  if (!last || card.price == null) return "";
  const previous = formatPrice(last.from, card.currency);
  if (last.to < last.from) return `Price fell from ${previous}`;
  if (last.to > last.from) return `Price rose from ${previous}`;
  return "";
}

export function askForGaps(card: CardRow, arabic: boolean) {
  const missing = missingLabels(card);
  if (!missing.length) return "";
  const have = knownLines(card, arabic);
  const need = missing.map((label) => GAP_WORDS[label][arabic ? "ar" : "en"]);
  const bullets = (lines: string[]) => lines.map((line) => `• ${line}`).join("\n");
  const title = card.title || (arabic ? "هذه الوحدة" : "this unit");
  if (arabic) {
    return [`مرحبا، استلمنا تفاصيل ${title}.`, have.length ? `الموجود عندنا:\n${bullets(have)}` : "", `الناقص:\n${bullets(need)}`, "أرسل هذه البيانات حتى نكمل السجل."].filter(Boolean).join("\n\n");
  }
  return [`Thanks for the details for ${title}.`, have.length ? `We already have:\n${bullets(have)}` : "", `Still needed:\n${bullets(need)}`, "Please send these so we can complete the record."].filter(Boolean).join("\n\n");
}

export function listingCriteria(card: CardRow, hasPhoto: boolean, hasDeveloper: boolean) {
  const extra = readExtra(card.extra);
  const kind = profile(card.property_type);
  const specific =
    kind === "land"
      ? [{ label: "Plot", ok: card.size_sqm != null || Boolean(extra.plot) }]
      : kind === "office"
        ? [
            { label: "Size", ok: card.size_sqm != null },
            { label: "Floor", ok: Boolean(extra.floor) },
            { label: "Parking", ok: Boolean(extra.parking) },
          ]
        : kind === "warehouse"
          ? [{ label: "Size", ok: card.size_sqm != null }]
          : kind === "building"
            ? [
                { label: "Plot", ok: Boolean(extra.plot) },
                { label: "Built-up", ok: card.size_sqm != null },
                { label: "Floors", ok: Boolean(extra.storeys) },
                { label: "Units", ok: Boolean(extra.unitCount) },
              ]
            : kind === "villa"
              ? [
                  { label: "Bedrooms", ok: card.bedrooms != null },
                  { label: "Bathrooms", ok: card.bathrooms != null },
                  { label: "Built-up", ok: card.size_sqm != null },
                  { label: "Plot", ok: Boolean(extra.plot) },
                  { label: "Handover", ok: Boolean(extra.handover) },
                ]
              : [
                  { label: "Bedrooms", ok: card.bedrooms != null },
                  { label: "Bathrooms", ok: card.bathrooms != null },
                  { label: "Size", ok: card.size_sqm != null },
                  { label: "Handover", ok: Boolean(extra.handover) },
                ];
  const items = [
    { label: "Photo", ok: hasPhoto },
    { label: "Price", ok: card.price != null },
    { label: "Location", ok: Boolean(card.city || card.area) },
    { label: "Type", ok: Boolean(card.property_type) },
    ...specific,
    { label: card.kind === "inquiry" ? "Phone" : "Developer", ok: card.kind === "inquiry" ? Boolean(card.sender_phone) : hasDeveloper },
  ];
  const done = items.filter((item) => item.ok).length;
  return { items, done, total: items.length };
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
    ...(extra.planLabel ? [fact("plan", "Payment", "layers", extra.planLabel)] : []),
  ];
}

export function cardSlots(card: CardRow): Fact[] {
  const facts = propertyFacts(card);
  const kind = profile(card.property_type);
  const wanted = kind === "land" ? ["plot"] : kind === "office" || kind === "warehouse" ? ["size"] : kind === "building" ? ["plot", "size"] : ["bedrooms", "bathrooms", "size"];
  return wanted.map((key) => facts.find((item) => item.key === key)).filter((item): item is Fact => Boolean(item));
}
