"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/icons";
import { Logo } from "@/components/logo";
import { TopBar } from "@/components/top-bar";
import { DEFAULT_SETTINGS, SETTINGS_EVENT, type DeskSettings } from "@/lib/desk-defaults";
import { applyDeskLocale } from "@/lib/format";

const LINKS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/properties", label: "Properties", icon: "building" },
  { href: "/clients", label: "Clients", icon: "user" },
  { href: "/suppliers", label: "Developers", icon: "layers" },
  { href: "/inbox", label: "WhatsApp", icon: "chat" },
  { href: "/review", label: "Review", icon: "check" },
  { href: "/reports", label: "Reports", icon: "sheet" },
  { href: "/whatsapp", label: "Link", icon: "phone" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

const DeskPrefsContext = createContext<DeskSettings>(DEFAULT_SETTINGS);

export function useDeskPrefs() {
  return useContext(DeskPrefsContext);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<DeskSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch("/api/settings");
      if (!response.ok || stop) return;
      const body = await response.json();
      applyDeskLocale(body.settings);
      setSettings(body.settings);
    }
    void load();
    window.addEventListener(SETTINGS_EVENT, load);
    return () => {
      stop = true;
      window.removeEventListener(SETTINGS_EVENT, load);
    };
  }, []);

  return (
    <DeskPrefsContext.Provider value={settings}>
    <div className="flex h-screen overflow-hidden bg-paper">
      <aside className="flex w-60 shrink-0 flex-col bg-pine text-white">
        <div className="px-4 py-5">
          <Logo src={settings.logo} alt={settings.officeName} />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 pb-4">
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
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div className="absolute inset-0 flex min-h-0 flex-col">{children}</div>
        </main>
      </div>
    </div>
    </DeskPrefsContext.Provider>
  );
}
