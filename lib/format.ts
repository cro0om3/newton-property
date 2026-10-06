export const PROPERTY_LABELS: Record<string, string> = {
  villa: "Villa",
  apartment: "Apartment",
  land: "Land",
  office: "Office",
  warehouse: "Warehouse",
  townhouse: "Townhouse",
  building: "Building",
  other: "Other",
};

export const PURPOSE_LABELS: Record<string, string> = {
  sale: "For sale",
  rent: "For rent",
  buy: "Wants to buy",
  seek_rent: "Wants to rent",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  viewing: "Viewing",
  offer: "Offer",
  closed: "Closed",
  needs_review: "Needs review",
};

export const PIPELINE = ["new", "contacted", "viewing", "offer", "closed", "needs_review"] as const;

export function label(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return "—";
  return map[value] || value;
}

export function propertyLabel(value: string | null | undefined) {
  return label(PROPERTY_LABELS, value);
}

export function purposeLabel(value: string | null | undefined) {
  return label(PURPOSE_LABELS, value);
}

export function statusLabel(value: string | null | undefined) {
  return label(STATUS_LABELS, value);
}

export function formatPrice(price: number | null, currency: string | null, digits = 0) {
  if (price == null || Number.isNaN(price)) return "Price not set";
  const code = currency || "AED";
  try {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(price);
  } catch {
    return `${code} ${price.toLocaleString("en-AE")}`;
  }
}

export function formatRooms(bedrooms: number | null | undefined) {
  if (bedrooms == null) return "—";
  if (bedrooms === 0) return "Studio";
  return String(bedrooms);
}

export function formatWhen(timestamp: number | null | undefined) {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return "—";
  return phone.startsWith("+") ? phone : `+${digits}`;
}

export function whatsappHref(phone: string | null | undefined) {
  const shown = formatPhone(phone);
  if (shown === "—") return null;
  return `https://wa.me/${shown.replace(/\D/g, "")}`;
}
