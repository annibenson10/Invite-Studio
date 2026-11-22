import type { Metadata } from "next";
import { loadInvitation } from "@/lib/server/public-guest";
import { RsvpForm } from "./rsvp-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "RSVP", robots: { index: false, follow: false } };

export default async function RsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const invitation = await loadInvitation(token);
  const hint = query.r === "yes" || query.r === "no" ? query.r : null;

  if (!invitation) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas p-5">
        <section className="w-full max-w-sm rounded-3xl bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <h1 className="text-xl font-bold">Invitation not found</h1>
          <p className="mt-2 text-sm leading-6 text-ink-2">This RSVP link isn’t valid. Please check the message you received, or contact the organiser.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-night">
      {invitation.flyerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={invitation.flyerUrl} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
      )}
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-end gap-4 p-4 sm:justify-center sm:p-6">
        {invitation.flyerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={invitation.flyerUrl} alt={`${invitation.eventName} flyer`} className="mx-auto max-h-[38dvh] w-auto rounded-2xl object-contain shadow-[var(--shadow-float)]" />
        )}
        <section className="rounded-[28px] bg-surface p-6 shadow-[var(--shadow-float)] sm:p-8">
          <RsvpForm token={token} guestName={invitation.guestName} eventName={invitation.eventName} initialResponse={invitation.rsvp} hint={hint} />
        </section>
        <a href={`/t/${token}`} className="pb-safe mx-auto mb-2 text-sm font-semibold text-white/80 underline-offset-4 hover:underline">
          View my ticket →
        </a>
      </div>
    </main>
  );
}
