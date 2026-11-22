"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, Loader2, QrCode, Send, Users } from "lucide-react";
import { api } from "@/lib/client";
import { Logo } from "@/components/brand";

export function LoginForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", json: { password } });
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-night p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="invite-card absolute inset-0 opacity-90" />
        <div className="relative"><Logo dark /></div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-[1.15] tracking-tight">Every guest gets an invitation made just for them.</h2>
          <ul className="mt-8 space-y-4 text-white/80">
            {[
              [Users, "Upload a guest list or add guests one by one"],
              [Send, "Send personalised flyers on WhatsApp or email"],
              [QrCode, "Collect RSVPs and scan guests in at the door"],
            ].map(([Icon, text]) => {
              const I = Icon as typeof Users;
              return (
                <li key={text as string} className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-white/10"><I size={17} /></span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>
        <p className="relative text-sm text-white/40">Invite Studio</p>
      </section>

      <section className="flex items-center justify-center bg-canvas p-5">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="lg:hidden"><Logo /></div>
          <h1 className="mt-8 text-3xl font-bold tracking-tight lg:mt-0">Welcome back</h1>
          <p className="mt-2 text-ink-2">Sign in to manage your events.</p>
          {configured ? (
            <>
              <label className="mt-8 block">
                <span className="mb-2 block text-sm font-semibold">Password</span>
                <span className="relative block">
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    autoFocus
                    className="h-13 w-full rounded-2xl border border-line bg-surface px-4 pr-12 text-base outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
                  />
                  <button type="button" onClick={() => setShow((value) => !value)} className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-ink-3 hover:bg-black/5" aria-label={show ? "Hide password" : "Show password"}>
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              {error && <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{error}</p>}
              <button disabled={busy || !password} className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-base font-bold text-white transition hover:bg-black disabled:opacity-40">
                {busy && <Loader2 size={18} className="animate-spin" />} {busy ? "Signing in…" : "Sign in"}
              </button>
              <p className="mt-8 rounded-2xl border border-line bg-surface p-4 text-sm leading-6 text-ink-2">
                <span className="font-semibold text-ink">Door staff?</span> Go to{" "}
                <a href="/checkin" className="font-semibold text-brand-ink underline underline-offset-4">/checkin</a> and enter the event PIN.
              </p>
            </>
          ) : (
            <p className="mt-6 rounded-2xl bg-brand-soft p-4 text-sm leading-6 text-brand-ink">
              No organiser password has been set yet. Add <code className="font-mono font-semibold">ADMIN_PASSWORD</code> as a secret in your hosting settings, then reload this page.
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
