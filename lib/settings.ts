import { DEFAULT_SETTINGS, PIPELINE_KEYS, type DeskSettings, type PipelineKey } from "./desk-defaults";
import { getDb } from "./db";
import { safeTimeZone } from "./time";

let cache: { at: number; value: DeskSettings } | null = null;

function cloneDefaults(): DeskSettings {
  return {
    ...DEFAULT_SETTINGS,
    brokers: [...DEFAULT_SETTINGS.brokers],
    pipelineLabels: { ...DEFAULT_SETTINGS.pipelineLabels },
  };
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function sanitizeSettings(input: Partial<DeskSettings>): DeskSettings {
  const base = cloneDefaults();
  const labels = { ...base.pipelineLabels };
  for (const key of PIPELINE_KEYS) {
    const value = input.pipelineLabels?.[key];
    if (typeof value === "string" && value.trim()) labels[key] = value.trim().slice(0, 40);
  }
  const brokers = Array.isArray(input.brokers)
    ? [...new Set(input.brokers.map((name) => String(name).trim()).filter(Boolean))].slice(0, 30).map((name) => name.slice(0, 40))
    : base.brokers;
  const currency = String(input.currency || base.currency).trim().toUpperCase();
  const logo = typeof input.logo === "string" && input.logo.startsWith("/") && !input.logo.includes("..") ? input.logo.slice(0, 180) : base.logo;
  const defaultBroker = String(input.defaultBroker || "").trim().slice(0, 40);
  return {
    officeName: String(input.officeName || base.officeName).trim().slice(0, 80) || base.officeName,
    officePhone: String(input.officePhone || "").trim().slice(0, 30),
    logo,
    defaultCity: String(input.defaultCity || "").trim().slice(0, 60),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : base.currency,
    timezone: safeTimeZone(String(input.timezone || base.timezone)),
    brokers,
    defaultBroker: brokers.includes(defaultBroker) ? defaultBroker : "",
    historyDays: Math.round(clamp(input.historyDays, 1, 7, base.historyDays)),
    analyzeHours: Math.round(clamp(input.analyzeHours, 1, 168, base.analyzeHours)),
    mediaDays: Math.round(clamp(input.mediaDays, 1, 7, base.mediaDays)),
    sortingEnabled: input.sortingEnabled !== false,
    reviewIfMissingPrice: input.reviewIfMissingPrice !== false,
    reviewIfMissingLocation: input.reviewIfMissingLocation !== false,
    reviewConfidence: clamp(input.reviewConfidence, 0.3, 0.95, base.reviewConfidence),
    budgetPercent: Math.round(clamp(input.budgetPercent, 0, 100, base.budgetPercent)),
    pipelineLabels: labels,
  };
}

export function getSettings(): DeskSettings {
  if (cache && Date.now() - cache.at < 5000) return cache.value;
  const row = getDb().prepare("SELECT value FROM desk_settings WHERE id = 1").get() as { value: string } | undefined;
  let value = cloneDefaults();
  if (row?.value) {
    try {
      value = sanitizeSettings(JSON.parse(row.value) as Partial<DeskSettings>);
    } catch {
      value = cloneDefaults();
    }
  }
  cache = { at: Date.now(), value };
  return value;
}

export function saveSettings(input: Partial<DeskSettings>) {
  const current = getSettings();
  const next = sanitizeSettings({ ...current, ...input, pipelineLabels: { ...current.pipelineLabels, ...input.pipelineLabels } });
  getDb()
    .prepare("INSERT INTO desk_settings (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value")
    .run(JSON.stringify(next));
  cache = { at: Date.now(), value: next };
  return next;
}

export function emptyPipeline(): Record<PipelineKey, string> {
  return { ...DEFAULT_SETTINGS.pipelineLabels };
}
