import { NextResponse } from "next/server";
import { dueFollowUps, listCards, stats } from "@/lib/db";
import { readStatus } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const totals = stats();
  const whatsapp = readStatus();
  const followUps = dueFollowUps();
  const alerts = [];
  if (whatsapp.state !== "connected") {
    alerts.push({
      id: "wa-offline",
      title: "WhatsApp is offline",
      body: "New messages will not arrive until this computer is linked again.",
      href: "/whatsapp",
    });
  }
  if (whatsapp.lastError) {
    alerts.push({
      id: `wa-error-${whatsapp.updatedAt}`,
      title: "WhatsApp needs attention",
      body: whatsapp.lastError,
      href: "/whatsapp",
    });
  }
  if (!whatsapp.openai) {
    alerts.push({
      id: "openai-off",
      title: "Automatic sorting is paused",
      body: "Messages are saved. Add an OpenAI key when you want them sorted for you.",
      href: "/dashboard",
    });
  }
  if (totals.pendingSort > 0) {
    alerts.push({
      id: `sort-${totals.pendingSort}`,
      title: `${totals.pendingSort} messages waiting to sort`,
      body: "File them as a property or a client.",
      href: "/review",
    });
  }
  if (totals.needsReview > 0) {
    alerts.push({
      id: `review-${totals.needsReview}`,
      title: `${totals.needsReview} records need review`,
      body: "Confirm the details before the desk relies on them.",
      href: "/review",
    });
  }
  if (totals.unassigned > 0) {
    alerts.push({
      id: `broker-${totals.unassigned}`,
      title: `${totals.unassigned} records have no broker`,
      body: "Assign a broker so the follow-up does not stall.",
      href: "/review",
    });
  }
  if (totals.failedReplies > 0) {
    alerts.push({
      id: `failed-${totals.failedReplies}`,
      title: `${totals.failedReplies} replies did not send`,
      body: "Check that WhatsApp is still linked on this computer.",
      href: "/inbox",
    });
  }
  for (const row of followUps) {
    alerts.push({
      id: `follow-${row.id}-${row.next_follow_up}`,
      title: row.title || "Follow-up due",
      body: "Due today or already overdue.",
      href: row.kind === "inquiry" ? `/clients/${row.id}` : `/properties/${row.id}`,
    });
  }
  return NextResponse.json({
    ...totals,
    recent: listCards({ kind: "listing", limit: 4 }),
    recentClients: listCards({ kind: "inquiry", limit: 4 }),
    followUpCards: followUps,
    alerts,
    whatsapp,
  });
}
