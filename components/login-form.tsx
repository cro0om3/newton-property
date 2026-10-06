"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/logo";

export function LoginForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("That code is not correct.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-3xl border border-line bg-panel px-8 py-10 shadow-sm">
        <Logo light />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Enter code</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Newton Property sorts WhatsApp listings so brokers can find the right unit fast.
        </p>
        <label className="mt-8 block text-sm font-medium" htmlFor="code">
          Access code
        </label>
        <input
          id="code"
          type="password"
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none ring-leaf focus:ring-2"
        />
        {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
        <button
          type="submit"
          disabled={busy || !code}
          className="mt-6 w-full rounded-xl bg-pine px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
