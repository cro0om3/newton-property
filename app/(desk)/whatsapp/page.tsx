"use client";

import { useEffect, useState } from "react";
import type { WaStatus } from "@/lib/status";

type MetaStatus = {
  configured: boolean;
  connected: boolean;
  pages: { id: string; name: string; instagramName: string | null }[];
};

type OfficialCard = {
  id: string;
  name: string;
  mode: "oauth" | "token" | "none";
  detail: string;
  keys: string[];
  configured: boolean;
  connected: boolean;
  account: string;
};

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WaStatus | null>(null);
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [metaNote, setMetaNote] = useState("");
  const [metaReason, setMetaReason] = useState("");
  const [networks, setNetworks] = useState<OfficialCard[]>([]);
  const [botToken, setBotToken] = useState("");
  const [linkNote, setLinkNote] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    setMetaNote(url.searchParams.get("meta") || "");
    setMetaReason(url.searchParams.get("reason") || "");
    if (url.searchParams.get("link") === "connected") setLinkNote(`${url.searchParams.get("network") || "Network"} connected${url.searchParams.get("account") ? `: ${url.searchParams.get("account")}` : ""}.`);
    if (url.searchParams.get("link") === "failed") setLinkNote(url.searchParams.get("reason") || "That login did not finish.");
  }, []);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch("/api/whatsapp");
      if (!response.ok || stop) return;
      setStatus(await response.json());
      const metaResponse = await fetch("/api/meta");
      if (metaResponse.ok) setMeta(await metaResponse.json());
      const officialResponse = await fetch("/api/official");
      if (officialResponse.ok) {
        const body = await officialResponse.json();
        setNetworks(body.networks || []);
      }
    }
    void load();
    const timer = setInterval(load, 2000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  const state = status?.state || "offline";
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    if (!window.confirm("Disconnect this WhatsApp number? A new code will appear so you can link a different phone.")) return;
    setBusy(true);
    await fetch("/api/whatsapp", { method: "POST" });
    setBusy(false);
  }

  async function disconnectMeta() {
    if (!window.confirm("Disconnect Facebook? Messenger and Instagram messages will stop arriving.")) return;
    setBusy(true);
    const response = await fetch("/api/meta", { method: "POST" });
    if (response.ok) setMeta(await response.json());
    setBusy(false);
  }

  async function saveBot() {
    setBusy(true);
    setLinkNote("");
    const response = await fetch("/api/official", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "telegram", token: botToken }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setLinkNote(body.error || "Could not save the bot.");
      return;
    }
    setBotToken("");
    setNetworks(body.networks || []);
    setLinkNote(`Telegram connected: ${body.account}`);
  }

  async function disconnectNetwork(id: string, name: string) {
    if (!window.confirm(`Disconnect ${name}?`)) return;
    const response = await fetch("/api/official", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) {
      const body = await response.json();
      setNetworks(body.networks || []);
    }
  }

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <h1 className="text-3xl font-semibold tracking-tight">Link</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Keep the phone link. The cards below are the official logins: Facebook, TikTok, LinkedIn, YouTube, X, and Telegram.
      </p>
      {metaNote === "connected" ? <p className="mt-3 text-sm text-leaf">Facebook is connected.</p> : null}
      {metaNote === "failed" ? <p className="mt-3 text-sm text-clay">{metaReason || "Facebook login did not finish."}</p> : null}
      {linkNote ? <p className="mt-3 text-sm text-muted">{linkNote}</p> : null}

      <div className="mt-6 grid max-w-4xl gap-4 lg:grid-cols-[280px_1fr]">
        <div className="grid min-h-72 place-items-center desk-card rounded-3xl border border-line bg-panel p-4">
          {state === "qr" && status?.qrDataUrl ? (
            <img src={status.qrDataUrl} alt="WhatsApp QR code" className="w-full" />
          ) : (
            <p className="px-4 text-center text-sm text-muted">
              {state === "connected"
                ? "Linked"
                : state === "reconnecting"
                  ? "Connecting..."
                  : "Waiting for the WhatsApp service"}
            </p>
          )}
        </div>
        <div className="desk-card rounded-3xl border border-line bg-panel p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">This phone</p>
          <p className="mt-2 text-sm font-medium">
            Status: {state === "connected" ? "Connected" : state === "qr" ? "Ready to scan" : state}
          </p>
          {status?.phone ? <p className="mt-1 text-sm text-muted">{status.phone}</p> : null}
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-6">
            <li>Open WhatsApp on your phone.</li>
            <li>Go to Settings, then Linked devices, then Link a device.</li>
            <li>Scan the code on the left.</li>
          </ol>
          <p className="mt-5 text-sm leading-6 text-muted">
            Leave this computer on and online. If it sleeps, new messages wait until it wakes. People still message your same number.
          </p>
          {state === "connected" ? (
            <button type="button" onClick={() => void disconnect()} disabled={busy} className="mt-5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-clay disabled:opacity-50">
              {busy ? "Disconnecting..." : "Disconnect WhatsApp"}
            </button>
          ) : null}
          {status?.lastError ? <p className="mt-4 text-sm text-clay">{status.lastError}</p> : null}
          {!status?.openai ? (
            <p className="mt-4 text-sm text-clay">
              Messages are saved. Automatic sorting starts after an OpenAI key is added and the desk is restarted.
            </p>
          ) : (
            <p className="mt-4 text-sm text-muted">Sorting model: {status.model}</p>
          )}
        </div>
      </div>

      <div className="mt-4 grid max-w-4xl gap-4 lg:grid-cols-2">
        <section className="desk-card rounded-3xl border border-line bg-panel p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Official</p>
          <h2 className="mt-2 text-lg font-semibold">Facebook</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            One login brings Messenger and the Instagram account linked to that Page. Official WhatsApp Business uses the same Meta app after the number is registered there. The phone link above stays.
          </p>
          {meta?.connected ? (
            <ul className="mt-4 space-y-2 text-sm">
              {meta.pages.map((page) => (
                <li key={page.id}>
                  <span className="font-medium">{page.name}</span>
                  <span className="block text-muted">{page.instagramName ? `Instagram @${page.instagramName}` : "No Instagram on this Page"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-muted">
              {meta?.configured
                ? "Connect the Facebook account that owns the Page."
                : "Save the Facebook keys in Settings. Connect turns on after that."}
            </p>
          )}
          {meta?.connected ? (
            <button type="button" onClick={() => void disconnectMeta()} disabled={busy} className="mt-5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-clay disabled:opacity-50">
              Disconnect Facebook
            </button>
          ) : (
            <a href="/api/meta/connect" className={`mt-5 inline-block rounded-xl bg-pine px-4 py-2 text-sm font-medium text-white ${meta?.configured ? "" : "pointer-events-none opacity-50"}`}>
              Connect Facebook
            </a>
          )}
        </section>
        {networks.map((network) => (
          <section key={network.id} className="desk-card rounded-3xl border border-line bg-panel p-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Official</p>
            <h2 className="mt-2 text-lg font-semibold">{network.name}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{network.detail}</p>
            {network.connected ? <p className="mt-3 text-sm font-medium">Connected: {network.account}</p> : null}
            {network.mode === "oauth" && !network.configured ? (
              <p className="mt-3 text-sm text-muted">Save {network.keys.join(" and ")} in Settings. Connect turns on after that.</p>
            ) : null}
            {network.mode === "token" && !network.connected ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <input value={botToken} onChange={(event) => setBotToken(event.target.value)} placeholder="Bot token" className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
                <button type="button" onClick={() => void saveBot()} disabled={busy || !botToken.trim()} className="rounded-xl bg-pine px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Save bot
                </button>
              </div>
            ) : null}
            {network.connected ? (
              <button type="button" onClick={() => void disconnectNetwork(network.id, network.name)} disabled={busy} className="mt-4 rounded-xl border border-line px-4 py-2 text-sm font-medium text-clay disabled:opacity-50">
                Disconnect
              </button>
            ) : network.mode === "oauth" ? (
              <a href={`/api/official/${network.id}/connect`} className={`mt-4 inline-block rounded-xl bg-pine px-4 py-2 text-sm font-medium text-white ${network.configured ? "" : "pointer-events-none opacity-50"}`}>
                Connect {network.name}
              </a>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
