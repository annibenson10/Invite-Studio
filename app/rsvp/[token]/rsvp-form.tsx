"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { api } from "@/lib/client";

type Answer = "yes" | "no";

/**
 * One tap on Yes or No records the answer. (Link previews in chat apps load
 * the page but never tap buttons, so they can't answer on a guest's behalf.)
 */
export function RsvpForm({
  token,
  guestName,
  eventName,
  initialResponse,
  hint,
}: {
  token: string;
  guestName: string;
  eventName: string;
  initialResponse: Answer | null;
  hint: Answer | null;
}) {
  const [response, setResponse] = useState<Answer | null>(initialResponse);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [pending, setPending] = useState<Answer | null>(null);
  const [error, setError] = useState("");
  const firstName = guestName.split(/\s+/)[0];

  async function answer(choice: Answer) {
    if (pending) return;
    setPending(choice);
    setError("");
    try {
      const result = await api<{ response: Answer }>(`/api/rsvp/${token}`, { method: "POST", json: { response: choice } });
      setResponse(result.response);
      setJustSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  if (response) {
    const yes = response === "yes";
    return (
      <div className="text-center" role="status">
        <div className={`mx-auto grid size-16 place-items-center rounded-full ${yes ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {yes ? <Check size={30} strokeWidth={2.5} /> : <X size={30} strokeWidth={2.5} />}
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          {justSubmitted ? (yes ? `See you there, ${firstName}!` : `Thanks for letting us know, ${firstName}`) : "You’ve already responded"}
        </h1>
        <p className="mt-2 text-ink-2">
          {eventName} · <span className={`font-semibold ${yes ? "text-success" : "text-danger"}`}>{yes ? "Attending" : "Not attending"}</span>
        </p>
        <p className="mx-auto mt-5 max-w-xs text-sm leading-6 text-ink-3">
          {yes ? "Bring your invitation with its QR code. It’s your entry pass at the door." : "Change of plans? Contact the organiser and they can update your response."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-brand">You’re invited</p>
      <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-tight">{eventName}</h1>
      <p className="mt-3 text-ink-2">
        Hi <span className="font-semibold text-ink">{guestName}</span>, will you be attending?
      </p>
      <div className="mt-6 grid gap-3">
        <button
          onClick={() => answer("yes")}
          disabled={Boolean(pending)}
          className={`flex h-14 items-center justify-center gap-2 rounded-2xl bg-success text-base font-bold text-white shadow-sm transition active:scale-[.98] disabled:opacity-70 ${hint === "yes" ? "ring-4 ring-success/25" : ""}`}
        >
          {pending === "yes" ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} strokeWidth={2.5} />} Yes, I’ll be there
        </button>
        <button
          onClick={() => answer("no")}
          disabled={Boolean(pending)}
          className={`flex h-14 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface text-base font-bold text-ink transition hover:border-danger/40 active:scale-[.98] disabled:opacity-70 ${hint === "no" ? "border-danger/50 ring-4 ring-danger/10" : ""}`}
        >
          {pending === "no" ? <Loader2 className="animate-spin" size={18} /> : <X size={18} strokeWidth={2.5} />} No, I can’t make it
        </button>
      </div>
      <p className="mt-4 text-center text-xs text-ink-3">Your answer is saved as soon as you tap. You can respond once.</p>
      {error && <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-center text-sm font-semibold text-danger">{error}</p>}
    </div>
  );
}
