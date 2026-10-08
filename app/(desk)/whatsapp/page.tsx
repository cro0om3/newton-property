"use client";

import { useEffect, useState } from "react";
import type { WaStatus } from "@/lib/status";

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WaStatus | null>(null);

  useEffect(() => {
    let stop = false;
    async function load() {
      const response = await fetch("/api/whatsapp");
      if (!response.ok || stop) return;
      setStatus(await response.json());
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

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <h1 className="text-3xl font-semibold tracking-tight">Link WhatsApp</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
        Scan once from your phone. This computer then receives new messages on the same number.
      </p>

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
          <p className="text-sm font-medium">
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
    </div>
  );
}
