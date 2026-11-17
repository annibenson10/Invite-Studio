"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { api } from "@/lib/client";

export function LoginForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
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
    <main className="grid min-h-screen place-items-center bg-[#f4f3ef] p-4 text-[#171512]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[26px] border border-black/8 bg-white p-7 shadow-[0_18px_60px_rgba(30,25,18,.08)]">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-[#f58220] text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-none">Invite Studio</h1>
            <p className="mt-1 text-xs text-black/50">Organiser sign-in</p>
          </div>
        </div>
        {configured ? (
          <>
            <label className="mt-7 block">
              <span className="mb-2 block text-sm font-semibold">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
                className="h-12 w-full rounded-xl border border-black/12 px-4 outline-none focus:border-[#f58220]"
              />
            </label>
            {error && <p className="mt-3 text-sm font-semibold text-[#a6372f]">{error}</p>}
            <button disabled={busy || !password} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#171512] font-bold text-white disabled:opacity-50">
              <LockKeyhole size={16} /> {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="mt-5 text-center text-xs leading-5 text-black/45">
              Door staff: go to <a href="/checkin" className="font-semibold text-[#c45d0b] underline">/checkin</a> and enter the event PIN.
            </p>
          </>
        ) : (
          <p className="mt-6 rounded-xl bg-[#fff7ed] p-4 text-sm leading-6 text-[#9a4c0e]">
            No organiser password has been set. Set <code className="font-mono">ADMIN_PASSWORD</code> on the server (see README.md), then reload.
          </p>
        )}
      </form>
    </main>
  );
}
