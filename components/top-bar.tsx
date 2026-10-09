"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useDeskPrefs, useViewer } from "@/components/shell";

type Alert = { id: string; title: string; body: string; href: string };

const SEEN_KEY = "newton-alerts-seen";

function sectionTitle(pathname: string) {
  if (pathname.startsWith("/properties")) return "Properties";
  if (pathname.startsWith("/clients")) return "Clients";
  if (pathname.startsWith("/suppliers")) return "Developers";
  if (pathname.startsWith("/inbox")) return "WhatsApp";
  if (pathname.startsWith("/review")) return "Review";
  if (pathname.startsWith("/reports")) return "Reports";
  if (pathname.startsWith("/whatsapp")) return "Link";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}

function readSeen() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return new Set<string>(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const office = useDeskPrefs();
  const { viewer, setViewer } = useViewer();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<"alerts" | "account" | null>(null);
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch(viewer ? `/api/stats?assignee=${encodeURIComponent(viewer)}` : "/api/stats");
      if (!response.ok || stop) return;
      const body = await response.json();
      setAlerts(body.alerts || []);
      setConnected(body.whatsapp?.state === "connected");
      setPhone(body.whatsapp?.phone || null);
    }
    void load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [viewer]);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!barRef.current?.contains(event.target as Node)) setOpen(null);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  const unseen = alerts.filter((alert) => !seen.has(alert.id)).length;

  function toggle(panel: "alerts" | "account") {
    setOpen((current) => (current === panel ? null : panel));
    if (panel === "alerts") {
      const next = new Set(seen);
      for (const alert of alerts) next.add(alert.id);
      setSeen(next);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...next].slice(-200)));
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header ref={barRef} className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-panel px-5">
      <p className="text-sm font-semibold tracking-tight">{sectionTitle(pathname)}</p>
      <div className="flex items-center gap-2">
        <Link href="/whatsapp" className="hidden items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink sm:inline-flex">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-400"}`} />
          {connected ? phone || "WhatsApp connected" : "WhatsApp offline"}
        </Link>
        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => toggle("alerts")}
            className="relative grid h-9 w-9 place-items-center rounded-full text-pine hover:bg-paper"
          >
            <Icon name="bell" className="h-[18px] w-[18px]" />
            {unseen > 0 ? (
              <span className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-leaf px-1 text-[10px] font-semibold text-white">
                {unseen > 9 ? "9+" : unseen}
              </span>
            ) : null}
          </button>
          {open === "alerts" ? (
            <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_16px_40px_rgba(7,24,51,0.12)]">
              <div className="border-b border-line px-4 py-3">
                <p className="text-sm font-semibold">Notifications</p>
                <p className="text-xs text-muted">{alerts.length ? "What the desk needs next" : "Nothing waiting"}</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {alerts.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-muted">You are up to date.</p>
                ) : (
                  alerts.map((alert) => (
                    <Link key={alert.id} href={alert.href} onClick={() => setOpen(null)} className="block border-t border-line px-4 py-3 hover:bg-paper">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-muted">{alert.body}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="relative">
          <button
            type="button"
            aria-label="Account"
            onClick={() => toggle("account")}
            className="grid h-9 min-w-9 place-items-center rounded-full bg-pine px-2 text-xs font-semibold text-white"
          >
            {viewer ? viewer.slice(0, 1).toUpperCase() : "All"}
          </button>
          {open === "account" ? (
            <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_16px_40px_rgba(7,24,51,0.12)]">
              <div className="px-4 py-3">
                <p className="text-sm font-semibold">{office.officeName}</p>
                <p className="text-xs text-muted">{viewer ? viewer : "Owner sees the whole office"}</p>
              </div>
              <div className="border-t border-line px-2 py-2">
                <button type="button" onClick={() => { setViewer(""); setOpen(null); }} className={`block w-full rounded-xl px-2 py-2 text-left text-sm ${viewer ? "hover:bg-paper" : "bg-sand font-medium"}`}>
                  Owner
                </button>
                {office.brokers.map((name) => (
                  <button key={name} type="button" onClick={() => { setViewer(name); setOpen(null); }} className={`block w-full rounded-xl px-2 py-2 text-left text-sm ${viewer === name ? "bg-sand font-medium" : "hover:bg-paper"}`}>
                    {name}
                  </button>
                ))}
                {office.brokers.length === 0 ? <p className="px-2 py-2 text-xs text-muted">Add broker names in Settings to split the desk.</p> : null}
              </div>
              <Link href="/settings" onClick={() => setOpen(null)} className="block border-t border-line px-4 py-3 text-sm font-medium text-pine hover:bg-paper">
                Settings
              </Link>
              <button type="button" onClick={() => void logout()} className="w-full border-t border-line px-4 py-3 text-left text-sm font-medium text-pine hover:bg-paper">
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
