"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { PIPELINE_KEYS, SETTINGS_EVENT, type DeskSettings, type PipelineKey } from "@/lib/desk-defaults";
import type { WaStatus } from "@/lib/status";

const ZONES = ["Asia/Dubai", "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Europe/London", "UTC"];
const CURRENCIES = ["AED", "SAR", "QAR", "USD", "EUR", "GBP"];

type Secrets = { accessCodeSet: boolean; openaiKeySet: boolean; openaiModel: string; social?: Record<string, boolean> };

type Payload = {
  settings: DeskSettings;
  secrets: Secrets;
  whatsapp: WaStatus;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<DeskSettings | null>(null);
  const [secrets, setSecrets] = useState<Secrets | null>(null);
  const [whatsapp, setWhatsapp] = useState<WaStatus | null>(null);
  const [brokerText, setBrokerText] = useState("");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [social, setSocial] = useState<Record<string, string>>({});
  const [openaiModel, setOpenaiModel] = useState("gpt-6.1-sol");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void fetch("/api/settings")
      .then((response) => response.json())
      .then((body: Payload) => {
        setSettings(body.settings);
        setSecrets(body.secrets);
        setWhatsapp(body.whatsapp);
        setBrokerText(body.settings.brokers.join("\n"));
        setOpenaiModel(body.secrets.openaiModel || "gpt-6.1-sol");
      });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      void fetch("/api/whatsapp")
        .then((response) => response.json())
        .then((body: WaStatus) => setWhatsapp(body));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  function patch<K extends keyof DeskSettings>(key: K, value: DeskSettings[K]) {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  }

  function patchLabel(key: PipelineKey, value: string) {
    setSettings((current) => (current ? { ...current, pipelineLabels: { ...current.pipelineLabels, [key]: value } } : current));
  }

  async function saveDesk() {
    if (!settings) return;
    setError("");
    setSaved("");
    const brokers = brokerText.split(/\n/).map((name) => name.trim()).filter(Boolean);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, brokers }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error || "Could not save");
      return;
    }
    setSettings(body.settings);
    setBrokerText(body.settings.brokers.join("\n"));
    window.dispatchEvent(new Event(SETTINGS_EVENT));
    setSaved("Saved. The desk is using these settings.");
  }

  async function saveSecrets(payload: { accessCode?: string; openaiKey?: string; openaiModel?: string; clearOpenai?: boolean; social?: Record<string, string> }) {
    setError("");
    setSaved("");
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error || "Could not update");
      return;
    }
    setSecrets(body.secrets);
    setOpenaiKey("");
    if (body.signedOut) {
      window.location.href = "/";
      return;
    }
    if (body.secrets?.openaiModel) setOpenaiModel(body.secrets.openaiModel);
    setSaved(payload.accessCode ? "Access code updated." : payload.social ? "Social keys saved. Connect is ready on the Link page." : "ChatGPT API saved. The next message can be sorted.");
    if (payload.social) setSocial({});
  }

  async function testKey() {
    setError("");
    setSaved("");
    setTesting(true);
    const response = await fetch("/api/settings/openai-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: openaiKey }),
    });
    const body = await response.json().catch(() => null);
    setTesting(false);
    if (!response.ok) {
      setError(body?.error || "ChatGPT rejected the key");
      return;
    }
    setSaved("ChatGPT accepted the key.");
  }

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setError("");
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/settings/logo", { method: "POST", body: form });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      setError(body?.error || "Could not upload the logo");
      return;
    }
    setSettings(body.settings);
    window.dispatchEvent(new Event(SETTINGS_EVENT));
    setSaved("Logo updated.");
  }

  if (!settings || !secrets) {
    return <div className="h-full overflow-auto px-8 py-7 text-sm text-muted">Loading settings…</div>;
  }

  const connected = whatsapp?.state === "connected";

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">Office, team, WhatsApp, sorting, matching, and the name on reports.</p>
        </div>
        <button type="button" onClick={() => void saveDesk()} className="rounded-xl bg-pine px-4 py-2.5 text-sm font-medium text-white">
          Save settings
        </button>
      </div>
      {saved ? <p className="mt-4 text-sm font-medium text-leaf">{saved}</p> : null}
      {error ? <p className="mt-4 text-sm font-medium text-clay">{error}</p> : null}

      <div className="mt-6 grid items-start gap-4 xl:grid-cols-2">
        <Section className="xl:col-span-2" title="ChatGPT API" hint="Required for sorting messages, reading voice notes, and drafting replies. Paste the key from platform.openai.com. It stays on this computer and is never shown again.">
          <div className={`rounded-xl px-4 py-3 text-sm ${secrets.openaiKeySet ? "bg-sand text-pine" : "bg-paper text-clay"}`}>
            {secrets.openaiKeySet ? "A ChatGPT key is saved. Sorting can run." : "No ChatGPT key yet. Messages are saved, but they are not sorted."}
          </div>
          <Field label="API key" hint="Starts with sk-">
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={openaiKey}
                onChange={(event) => setOpenaiKey(event.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
                className={inputClass}
              />
              <button type="button" onClick={() => setShowKey((value) => !value)} className="shrink-0 rounded-xl border border-line px-3 text-sm">
                {showKey ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
          <Field label="Model" hint="Used for sorting and reply drafts.">
            <input value={openaiModel} onChange={(event) => setOpenaiModel(event.target.value)} list="chatgpt-models" className={inputClass} />
            <datalist id="chatgpt-models">
              <option value="gpt-6.1-sol" />
              <option value="gpt-4.1" />
              <option value="gpt-4o" />
            </datalist>
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveSecrets({ openaiKey, openaiModel })} className="rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white">Save API key</button>
            <button type="button" onClick={() => void testKey()} disabled={testing} className="rounded-xl border border-line px-3 py-2 text-sm font-medium">
              {testing ? "Testing…" : "Test key"}
            </button>
            {secrets.openaiKeySet ? (
              <button type="button" onClick={() => void saveSecrets({ clearOpenai: true })} className="rounded-xl border border-line px-3 py-2 text-sm font-medium text-clay">Remove key</button>
            ) : null}
          </div>
        </Section>

        <Section className="xl:col-span-2" title="Social apps" hint="Paste the keys from each developer site. They stay on this computer and are never shown again. Connect turns on in Link after you save.">
          <SocialKeys saved={secrets.social || {}} values={social} onChange={setSocial} onSave={() => void saveSecrets({ social })} />
        </Section>

        <Section title="Office" hint="Used on the sidebar, drafts, Excel, and the broker PDF.">
          <div className="flex items-center gap-4">
            <img src={settings.logo} alt="" className="h-16 w-28 rounded-xl bg-sand object-contain" />
            <label className="cursor-pointer rounded-xl border border-line px-3 py-2 text-sm font-medium">
              Upload logo
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void uploadLogo(event.target.files?.[0])} />
            </label>
          </div>
          <Field label="Office name">
            <input value={settings.officeName} onChange={(event) => patch("officeName", event.target.value)} className={inputClass} />
          </Field>
          <Field label="Phone on reports">
            <input value={settings.officePhone} onChange={(event) => patch("officePhone", event.target.value)} placeholder="+971…" className={inputClass} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Default city">
              <input value={settings.defaultCity} onChange={(event) => patch("defaultCity", event.target.value)} className={inputClass} />
            </Field>
            <Field label="Currency">
              <select value={settings.currency} onChange={(event) => patch("currency", event.target.value)} className={inputClass}>
                {CURRENCIES.map((code) => <option key={code}>{code}</option>)}
              </select>
            </Field>
            <Field label="Timezone">
              <select value={settings.timezone} onChange={(event) => patch("timezone", event.target.value)} className={inputClass}>
                {ZONES.map((zone) => <option key={zone}>{zone}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Team" hint="The owner sees every record. A name chosen from the account menu sees only the records assigned to that broker.">
          <Field label="Brokers" hint="One name on each line.">
            <textarea value={brokerText} onChange={(event) => setBrokerText(event.target.value)} rows={5} className={inputClass} />
          </Field>
          <Field label="Default broker">
            <select value={settings.defaultBroker} onChange={(event) => patch("defaultBroker", event.target.value)} className={inputClass}>
              <option value="">No default</option>
              {brokerText.split(/\n/).map((name) => name.trim()).filter(Boolean).map((name) => <option key={name}>{name}</option>)}
            </select>
          </Field>
          <Field label="Pipeline names" hint="The stages stay the same. These are the names people see.">
            <div className="grid gap-2 sm:grid-cols-2">
              {PIPELINE_KEYS.map((key) => (
                <input key={key} value={settings.pipelineLabels[key]} onChange={(event) => patchLabel(key, event.target.value)} className={inputClass} />
              ))}
            </div>
          </Field>
        </Section>

        <Section title="WhatsApp" hint="This computer must stay on. Replies are drafts until a broker presses Send.">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
            <div>
              <p className="text-sm font-medium">{connected ? "Connected" : "Not connected"}</p>
              <p className="text-xs text-muted">{whatsapp?.phone || "No number linked"}</p>
            </div>
            <Link href="/whatsapp" className="rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white">Open link</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Keep chats" hint="Last 7 days. New messages still arrive from any number.">
              <input type="number" min={1} max={7} value={settings.historyDays} onChange={(event) => patch("historyDays", Number(event.target.value))} className={inputClass} />
            </Field>
            <Field label="Sort recent" hint="Hours">
              <input type="number" min={1} max={168} value={settings.analyzeHours} onChange={(event) => patch("analyzeHours", Number(event.target.value))} className={inputClass} />
            </Field>
            <Field label="Download media" hint="Last 7 days">
              <input type="number" min={1} max={7} value={settings.mediaDays} onChange={(event) => patch("mediaDays", Number(event.target.value))} className={inputClass} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked disabled className="accent-pine" />
            Automatic sending stays off
          </label>
        </Section>

        <Section title="Sorting" hint="Uses the ChatGPT key above. Messages are saved either way.">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={settings.sortingEnabled} onChange={(event) => patch("sortingEnabled", event.target.checked)} className="accent-pine" />
            Sort new WhatsApp messages
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.reviewIfMissingPrice} onChange={(event) => patch("reviewIfMissingPrice", event.target.checked)} className="accent-pine" />
            Send to Review when the price is missing
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={settings.reviewIfMissingLocation} onChange={(event) => patch("reviewIfMissingLocation", event.target.checked)} className="accent-pine" />
            Send to Review when the city and area are missing
          </label>
          <Field label="Review below this confidence" hint="0.30 to 0.95">
            <input type="number" min={0.3} max={0.95} step={0.05} value={settings.reviewConfidence} onChange={(event) => patch("reviewConfidence", Number(event.target.value))} className={inputClass} />
          </Field>
        </Section>

        <Section title="Matching and follow-up" hint="A listing matches a client when the price stays inside this margin. Due today follows the office timezone.">
          <Field label="Budget margin" hint="Percent a listing may sit above the client's budget.">
            <input type="number" min={0} max={100} value={settings.budgetPercent} onChange={(event) => patch("budgetPercent", Number(event.target.value))} className={inputClass} />
          </Field>
        </Section>

        <Section title="Access" hint="Every computer that runs Start Newton uses this code.">
          <p className="text-sm font-medium">Access code: 1234</p>
        </Section>
      </div>
    </div>
  );
}

const SOCIAL_FIELDS = [
  ["META_APP_ID", "Facebook app ID"],
  ["META_APP_SECRET", "Facebook app secret"],
  ["META_VERIFY_TOKEN", "Facebook verify token"],
  ["TIKTOK_CLIENT_KEY", "TikTok client key"],
  ["TIKTOK_CLIENT_SECRET", "TikTok client secret"],
  ["LINKEDIN_CLIENT_ID", "LinkedIn client ID"],
  ["LINKEDIN_CLIENT_SECRET", "LinkedIn client secret"],
  ["GOOGLE_CLIENT_ID", "YouTube client ID"],
  ["GOOGLE_CLIENT_SECRET", "YouTube client secret"],
  ["X_CLIENT_ID", "X client ID"],
  ["X_CLIENT_SECRET", "X client secret"],
] as const;

function SocialKeys({
  saved,
  values,
  onChange,
  onSave,
}: {
  saved: Record<string, boolean>;
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SOCIAL_FIELDS.map(([key, label]) => (
        <Field key={key} label={label} hint={saved[key] ? "Saved. Paste a new value to replace it." : "Not saved yet."}>
          <input
            type="password"
            value={values[key] || ""}
            onChange={(event) => onChange({ ...values, [key]: event.target.value })}
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
          />
        </Field>
      ))}
      <div className="sm:col-span-2">
        <button type="button" onClick={onSave} disabled={!SOCIAL_FIELDS.some(([key]) => (values[key] || "").trim())} className="rounded-xl bg-pine px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          Save social keys
        </button>
      </div>
    </div>
  );
}

function Section({ title, hint, children, className = "" }: { title: string; hint: string; children: ReactNode; className?: string }) {
  return (
    <section className={`desk-card space-y-4 rounded-2xl border border-line bg-panel p-5 ${className}`}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs text-muted">{hint}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputClass = "w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm";
