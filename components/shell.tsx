"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/logo";
import type { WaStatus } from "@/lib/status";

const LINKS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/properties", label: "Properties", icon: "building" },
  { href: "/clients", label: "Clients", icon: "user" },
  { href: "/suppliers", label: "Suppliers", icon: "layers" },
  { href: "/inbox", label: "WhatsApp", icon: "chat" },
  { href: "/review", label: "Review", icon: "check" },
  { href: "/reports", label: "Reports", icon: "sheet" },
  { href: "/whatsapp", label: "Link", icon: "phone" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<WaStatus | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch("/api/whatsapp");
      if (!response.ok || stop) return;
      setStatus(await response.json());
    }
    void load();
    const timer = setInterval(load, 4000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const connected = status?.state === "connected";

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      <aside className="flex w-60 shrink-0 flex-col bg-pine text-white">
        <div className="px-4 py-5">
          <Logo />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium ${active ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10"}`}
              >
                <Icon name={link.icon} className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-300" : "bg-amber-300"}`} />
            {connected ? "WhatsApp connected" : "WhatsApp offline"}
          </p>
          <button onClick={logout} className="mt-3 text-sm text-white/70 hover:text-white">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
