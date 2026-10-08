import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function envPath() {
  return path.join(process.cwd(), ".env");
}

export function readEnvFile() {
  const values: Record<string, string> = {};
  let raw = "";
  try {
    raw = readFileSync(envPath(), "utf8");
  } catch {
    return values;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function secretValue(name: string) {
  const file = readEnvFile();
  if (file[name]) return file[name];
  return process.env[name] || "";
}

export function writeEnvValues(updates: Record<string, string>) {
  for (const value of Object.values(updates)) {
    if (/[\r\n]/.test(value)) throw new Error("Invalid value");
  }
  let raw = "";
  try {
    raw = readFileSync(envPath(), "utf8");
  } catch {
    raw = "";
  }
  const seen = new Set<string>();
  const next = raw.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return line;
    const key = trimmed.slice(0, eq).trim();
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }
  const text = next.join("\n").replace(/\n*$/, "\n");
  writeFileSync(envPath(), text);
}

export function reloadSecrets() {
  const file = readEnvFile();
  for (const key of ["OPENAI_API_KEY", "ACCESS_CODE", "OPENAI_MODEL", "OPENAI_TRANSCRIBE_MODEL", "OPENAI_REASONING"]) {
    if (file[key] != null) process.env[key] = file[key];
  }
}
