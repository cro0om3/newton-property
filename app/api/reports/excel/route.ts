import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { NA } from "@/lib/facts";
import { listCards, stats } from "@/lib/db";
import { applyDeskLocale, formatPhone, propertyLabel, purposeLabel, statusLabel } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import type { CardExtra, CardRow } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAVY = "FF071833";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cards = listCards({
    kind: url.searchParams.get("kind") || undefined,
    propertyType: url.searchParams.get("type") || undefined,
    purpose: url.searchParams.get("purpose") || undefined,
    status: url.searchParams.get("status") || undefined,
    q: url.searchParams.get("q") || undefined,
  });
  const summary = stats();
  const settings = getSettings();
  applyDeskLocale(settings);
  const book = new ExcelJS.Workbook();
  book.creator = settings.officeName;

  const overview = book.addWorksheet("Summary");
  overview.columns = [
    { header: "Metric", key: "metric", width: 22 },
    { header: "Count", key: "count", width: 28 },
  ];
  overview.addRows([
    { metric: "Office", count: settings.officeName },
    { metric: "Phone", count: settings.officePhone || "" },
    { metric: "New today", count: summary.newToday },
    { metric: "Listings", count: summary.listings },
    { metric: "Inquiries", count: summary.inquiries },
    { metric: "Villas", count: summary.villas },
    { metric: "Apartments", count: summary.apartments },
    { metric: "Land", count: summary.land },
    { metric: "Needs review", count: summary.needsReview },
    { metric: "Rows in this file", count: cards.length },
  ]);
  styleHeader(overview);

  const sheet = book.addWorksheet("Properties");
  sheet.columns = [
    { header: "Title", key: "title", width: 36 },
    { header: "Kind", key: "kind", width: 14 },
    { header: "Type", key: "type", width: 16 },
    { header: "Purpose", key: "purpose", width: 16 },
    { header: "Status", key: "status", width: 16 },
    { header: "City", key: "city", width: 16 },
    { header: "Area", key: "area", width: 24 },
    { header: "Price", key: "price", width: 16 },
    { header: "Currency", key: "currency", width: 12 },
    { header: "Bedrooms", key: "bedrooms", width: 12 },
    { header: "Bathrooms", key: "bathrooms", width: 12 },
    { header: "Size sqm", key: "size", width: 12 },
    { header: "Plot", key: "plot", width: 16 },
    { header: "Floor", key: "floor", width: 12 },
    { header: "Unit", key: "unit", width: 12 },
    { header: "Parking", key: "parking", width: 12 },
    { header: "View", key: "view", width: 18 },
    { header: "Furnished", key: "furnished", width: 14 },
    { header: "Handover", key: "handover", width: 16 },
    { header: "Sender", key: "sender", width: 18 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Reference", key: "reference", width: 18 },
  ];
  for (const card of cards) sheet.addRow(rowFor(card));
  styleHeader(sheet);

  const bytes = await book.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="newton-properties.xlsx"',
    },
  });
}

function lowestPrice(card: CardRow) {
  const extra = readExtra(card.extra);
  const plans = (extra.plans || []).filter((plan) => plan.price);
  if (!plans.length) return card.price;
  return Math.min(...plans.map((plan) => plan.discountedPrice || plan.price));
}

function rowFor(card: CardRow) {
  const extra = readExtra(card.extra);
  const phone = formatPhone(card.sender_phone);
  return {
    title: card.title || NA,
    kind: card.kind === "inquiry" ? "Inquiry" : "Listing",
    type: propertyLabel(card.property_type) === "—" ? NA : propertyLabel(card.property_type),
    purpose: purposeLabel(card.purpose) === "—" ? NA : purposeLabel(card.purpose),
    status: statusLabel(card.status),
    city: card.city || NA,
    area: card.area || NA,
    price: lowestPrice(card) ?? NA,
    currency: card.currency || "AED",
    bedrooms: card.bedrooms == null ? NA : card.bedrooms === 0 ? "Studio" : card.bedrooms,
    bathrooms: card.bathrooms ?? NA,
    size: card.size_sqm ?? NA,
    plot: extra.plot || NA,
    floor: extra.floor || NA,
    unit: extra.unit || NA,
    parking: extra.parking || NA,
    view: extra.view || NA,
    furnished: extra.furnished == null ? NA : extra.furnished ? "Yes" : "No",
    handover: extra.handover || NA,
    sender: card.sender_name || NA,
    phone: phone === "—" ? NA : phone,
    reference: extra.reference || NA,
  };
}

function readExtra(raw: string | null): CardExtra {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CardExtra;
  } catch {
    return {};
  }
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
}
