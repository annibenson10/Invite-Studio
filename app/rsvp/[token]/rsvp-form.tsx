"use client";

import { useState } from "react";
import { api } from "@/lib/client";

type Answer = "yes" | "no";

export function RsvpForm({
  token,
  guestName,
  eventName,
  initialResponse,
  preselect,
}: {
  token: string;
  guestName: string;
  eventName: string;
  initialResponse: Answer | null;
  preselect: Answer | null;
}) {
  const [response, setResponse] = useState<Answer | null>(initialResponse);
  const [choice, setChoice] = useState<Answer | null>(initialResponse ? null : preselect);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(answer: Answer) {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ response: Answer }>(`/api/rsvp/${token}`, { method: "POST", json: { response: answer } });
      setResponse(result.response);
      setJustSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (response) {
    return (
      <div>
        <div className={`mx-auto grid size-20 place-items-center rounded-full text-3xl text-white ${response === "yes" ? "bg-[#278237]" : "bg-[#a6372f]"}`}>
          {response === "yes" ? "✓" : "✕"}
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">{justSubmitted ? "Thank you, your response is saved" : "You have already responded"}</h1>
        <p className="mt-3 text-lg">
          <strong>{guestName}</strong>, {eventName}
        </p>
        <p className={`mt-5 text-xl font-bold ${response === "yes" ? "text-[#278237]" : "text-[#a6372f]"}`}>
          {response === "yes" ? "Attending" : "Not attending"}
        </p>
        <p className="mx-auto mt-6 max-w-sm text-sm leading-6 text-slate-500">
          {response === "yes"
            ? "Please bring your invitation with its QR code to the venue."
            : "Change of plans? Contact the organiser and they can update your response."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Will you be attending?</h1>
      <p className="mt-4 text-lg">
        Hello <strong>{guestName}</strong>,
      </p>
      <p className="mx-auto mt-1 max-w-md leading-7 text-slate-500">please let us know if you will attend {eventName}. You can respond once.</p>
      <div className="mx-auto mt-8 grid max-w-md gap-3 sm:grid-cols-2">
        <button
          onClick={() => setChoice("yes")}
          aria-pressed={choice === "yes"}
          className={`rounded-xl border-2 px-5 py-4 font-bold transition ${choice === "yes" ? "border-[#278237] bg-[#278237] text-white" : "border-[#278237] bg-white text-[#278237] hover:bg-green-50"}`}
        >
          Yes, I will attend
        </button>
        <button
          onClick={() => setChoice("no")}
          aria-pressed={choice === "no"}
          className={`rounded-xl border-2 px-5 py-4 font-bold transition ${choice === "no" ? "border-[#a6372f] bg-[#a6372f] text-white" : "border-[#a6372f] bg-white text-[#a6372f] hover:bg-red-50"}`}
        >
          No, I can’t attend
        </button>
      </div>
      {choice && (
        <button
          disabled={busy}
          onClick={() => submit(choice)}
          className="mx-auto mt-5 block w-full max-w-md rounded-xl bg-[#171512] px-5 py-4 font-bold text-white hover:bg-black disabled:opacity-60"
        >
          {busy ? "Saving…" : `Confirm: ${choice === "yes" ? "I will attend" : "I can’t attend"}`}
        </button>
      )}
      {error && <p className="mt-4 text-sm font-semibold text-[#a6372f]">{error}</p>}
    </div>
  );
}
