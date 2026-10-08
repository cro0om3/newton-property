"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { WhatsAppLink } from "@/components/whatsapp-link";
import { formatPhone } from "@/lib/format";
import type { DeveloperRow, SupplierRow } from "@/lib/types";

type ChatOption = { jid: string; name: string | null; phone: string | null };

function initials(label: string) {
  return label.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
}

function Mark({ logo, label, large = false }: { logo?: string | null; label: string; large?: boolean }) {
  const size = large ? "h-24 w-24 rounded-3xl text-2xl" : "h-14 w-14 rounded-2xl text-sm";
  if (logo) {
    return <img src={`/api/media/${logo}`} alt="" className={`${size} bg-panel object-cover`} />;
  }
  return (
    <span className={`grid place-items-center bg-sand font-semibold text-pine ${size}`}>
      {large ? <Icon name="building" className="h-10 w-10" /> : initials(label)}
    </span>
  );
}

export default function DeveloperPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [developer, setDeveloper] = useState<DeveloperRow | null>(null);
  const [employees, setEmployees] = useState<SupplierRow[]>([]);
  const [chats, setChats] = useState<ChatOption[]>([]);
  const [developers, setDevelopers] = useState<DeveloperRow[]>([]);
  const [name, setName] = useState("");
  const [chatJid, setChatJid] = useState("");
  const [missing, setMissing] = useState(false);
  const [note, setNote] = useState("");

  async function load() {
    const response = await fetch(`/api/suppliers/${params.id}`);
    if (response.status === 404) {
      setMissing(true);
      return;
    }
    if (!response.ok) return;
    const body = await response.json();
    setDeveloper(body.developer);
    setEmployees(body.employees || []);
    setChats(body.chats || []);
    setDevelopers(body.developers || []);
    setName(body.developer.name);
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function saveName() {
    const response = await fetch(`/api/suppliers/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) return;
    const body = await response.json();
    if (body.id && body.id !== params.id) router.replace(`/suppliers/${body.id}`);
    else await load();
  }

  async function uploadLogo(file: File) {
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/suppliers/${params.id}/logo`, { method: "POST", body: form });
    setNote(response.ok ? "Logo saved. It shows on properties from this developer." : "Could not save that image.");
    if (response.ok) await load();
  }

  async function addEmployee() {
    if (!chatJid) return;
    const chat = chats.find((item) => item.jid === chatJid);
    await fetch(`/api/suppliers/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatJid, employeeName: chat?.name || "" }),
    });
    setChatJid("");
    await load();
  }

  async function moveEmployee(person: SupplierRow, developerName: string) {
    await fetch(`/api/suppliers/employee/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: person.name, developer: developerName }),
    });
    await load();
  }

  if (missing) {
    return (
      <div className="px-8 py-7">
        <p>This developer is no longer here.</p>
        <Link href="/suppliers" className="mt-3 inline-block text-sm text-leaf">All developers</Link>
      </div>
    );
  }

  if (!developer) return <div className="px-8 py-7 text-sm text-muted">Loading...</div>;

  const taken = new Set(employees.map((person) => person.chat_jid).filter(Boolean));
  const available = chats.filter((chat) => !taken.has(chat.jid));

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto px-8 py-7">
      <Link href="/suppliers" className="inline-flex items-center gap-1.5 text-sm font-medium text-leaf">
        <Icon name="layers" className="h-4 w-4" />
        All developers
      </Link>

      <section className="desk-card mt-4 rounded-3xl border border-line bg-panel">
        <div className="bg-gradient-to-br from-sand via-panel to-panel px-6 py-6">
          <div className="flex flex-wrap items-center gap-5">
            <button type="button" onClick={() => fileRef.current?.click()} className="group relative overflow-hidden rounded-3xl border border-line bg-panel">
              <Mark logo={developer.logo} label={developer.name} large />
              <span className="absolute inset-x-0 bottom-0 bg-pine/75 py-1 text-center text-[11px] font-medium text-white">Upload logo</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Developer</p>
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full bg-transparent text-3xl font-semibold tracking-tight text-ink outline-none" />
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void saveName()} title="Save name" aria-label="Save name" className="grid h-9 w-9 place-items-center rounded-full bg-pine text-white">
                  <Icon name="check" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Delete developer"
                  aria-label="Delete developer"
                  onClick={() => {
                    if (!developer || !window.confirm(`Delete ${developer.name}? Employees stay, without a developer.`)) return;
                    void fetch(`/api/suppliers/${developer.id}`, { method: "DELETE" }).then((response) => {
                      if (response.ok) router.push("/suppliers");
                    });
                  }}
                  className="grid h-9 w-9 place-items-center rounded-full border border-line text-clay"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
                <Link href={`/properties?developer=${developer.id}`} className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel px-4 py-2 text-sm font-medium">
                  <Icon name="home" className="h-4 w-4" />
                  {developer.listings} listings
                </Link>
              </div>
              {note ? <p className="mt-3 text-xs text-muted">{note}</p> : null}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line">
          {[
            ["user", "Employees", developer.employees],
            ["home", "Listings", developer.listings],
            ["chat", "WhatsApp", employees.filter((person) => person.chat_jid).length],
          ].map(([icon, label, count]) => (
            <div key={String(label)} className="flex items-center gap-3 px-5 py-4">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sand text-pine">
                <Icon name={icon as "user"} className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs text-muted">{label}</p>
                <p className="text-lg font-semibold">{count}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <section className="desk-card rounded-3xl border border-line bg-panel p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-sand text-pine">
              <Icon name="user" className="h-4 w-4" />
            </span>
            Add employee
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">Pick someone from WhatsApp. They stay under this developer.</p>
          <select value={chatJid} onChange={(event) => setChatJid(event.target.value)} className="mt-4 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm">
            <option value="">Choose a chat</option>
            {available.map((chat) => (
              <option key={chat.jid} value={chat.jid}>{chat.name || formatPhone(chat.phone) || "Unnamed chat"}</option>
            ))}
          </select>
          <button type="button" onClick={() => void addEmployee()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-sm font-medium text-white">
            <Icon name="check" className="h-4 w-4" />
            Add
          </button>
        </section>

        <div className="grid gap-3 sm:grid-cols-2">
          {employees.map((person) => (
            <article key={person.id} className="desk-card flex flex-col rounded-3xl border border-line bg-panel p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pine text-sm font-semibold text-white">{initials(person.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{person.name}</p>
                  <p className="flex items-center gap-1 text-sm text-muted">
                    <Icon name="phone" className="h-3.5 w-3.5" />
                    {formatPhone(person.phone) || "No mobile"}
                  </p>
                </div>
                <button
                  type="button"
                  title="Remove employee"
                  aria-label="Remove employee"
                  onClick={() => {
                    if (!window.confirm(`Remove ${person.name} from this desk? Their WhatsApp chat stays.`)) return;
                    void fetch(`/api/suppliers/employee/${person.id}`, { method: "DELETE" }).then(() => load());
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-clay hover:bg-sand"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <WhatsAppLink phone={person.phone} />
                {person.chat_jid ? (
                  <Link href={`/inbox?chat=${encodeURIComponent(person.chat_jid)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs font-semibold">
                    <Icon name="chat" className="h-3.5 w-3.5" />
                    Chat
                  </Link>
                ) : null}
                <Link href={`/properties?supplier=${person.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-xs font-semibold">
                  <Icon name="home" className="h-3.5 w-3.5" />
                  {person.listings} listings
                </Link>
              </div>
              <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = String(new FormData(event.currentTarget).get("developer") || "");
                  if (!next) return;
                  void moveEmployee(person, next);
                  event.currentTarget.reset();
                }}
              >
                <select name="developer" defaultValue="" className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
                  <option value="">Move to another developer</option>
                  {developers.filter((item) => item.id !== developer.id).map((item) => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
                <button type="submit" className="rounded-xl border border-line px-3 py-2 text-sm font-medium">Move</button>
              </form>
            </article>
          ))}
          {employees.length === 0 ? <p className="text-sm text-muted">No employees yet.</p> : null}
        </div>
      </div>
    </div>
  );
}
