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
    <main className="grid min-h-screen bg-panel lg:grid-cols-2">
      <section className="hidden items-center bg-pine px-12 lg:flex">
        <Logo className="h-44 w-auto max-w-sm" />
      </section>
      <section className="grid place-items-center px-6 py-16">
        <form onSubmit={onSubmit} className="w-full max-w-sm">
          <div className="lg:hidden">
            <Logo className="h-20 w-auto" />
          </div>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight lg:mt-0">Sign in</h1>
          <label className="mt-8 block text-sm font-medium" htmlFor="code">
            Access code
          </label>
          <input
            id="code"
            type="password"
            autoFocus
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none ring-leaf focus:ring-2"
          />
          {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-xl bg-pine px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
