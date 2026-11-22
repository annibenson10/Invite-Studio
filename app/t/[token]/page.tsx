import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { loadInvitation } from "@/lib/server/public-guest";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your ticket", robots: { index: false, follow: false } };

/** What a guest sees if they scan or tap their own QR code: their ticket, not a check-in. */
export default async function TicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await loadInvitation(token);
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const qrSvg = invitation ? await QRCode.toString(`${protocol}://${host}/t/${token}`, { type: "svg", margin: 0 }) : "";

  if (!invitation) {
    return (
      <main className="grid min-h-dvh place-items-center bg-night p-5 text-white">
        <section className="max-w-sm text-center">
          <h1 className="text-xl font-bold">Ticket not found</h1>
          <p className="mt-2 text-sm text-white/60">This ticket link isn’t valid. Please contact the organiser.</p>
        </section>
      </main>
    );
  }

  const status = invitation.checkedInAt
    ? { text: "Checked in. Enjoy the event!", tone: "bg-success-soft text-success" }
    : invitation.rsvp === "no"
      ? { text: "You said you can’t attend. Contact the organiser if plans change.", tone: "bg-danger-soft text-danger" }
      : invitation.rsvp === "yes"
        ? { text: "You’re confirmed. Show this code at the entrance.", tone: "bg-success-soft text-success" }
        : null;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-night">
      {invitation.flyerUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={invitation.flyerUrl} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-35 blur-2xl" />
      )}
      <div className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-4">
        <section className="overflow-hidden rounded-[28px] bg-surface shadow-[var(--shadow-float)]">
          <div className="relative h-36 bg-night">
            {invitation.flyerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invitation.flyerUrl} alt="" className="size-full object-cover object-top opacity-90" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/65 to-black/35 backdrop-blur-[2px]" />
            <div className="absolute inset-x-5 bottom-4 text-white">
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-white/70">Admit one</p>
              <p className="truncate text-lg font-bold">{invitation.eventName}</p>
            </div>
          </div>
          <div className="relative px-6 pb-6 pt-5">
            {/* ticket notches */}
            <span aria-hidden className="absolute -left-3 -top-3 size-6 rounded-full bg-night" />
            <span aria-hidden className="absolute -right-3 -top-3 size-6 rounded-full bg-night" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Guest</p>
                <h1 className="mt-0.5 text-xl font-bold leading-tight">{invitation.guestName}</h1>
              </div>
              <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-ink">{invitation.category}</span>
            </div>
            <div className="mx-auto mt-5 w-full max-w-[240px] rounded-2xl border border-line p-4 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <p className="mt-3 text-center font-mono text-lg font-bold tracking-[.3em]">{invitation.ticketCode}</p>
            {status ? (
              <p className={`mt-5 rounded-2xl px-4 py-3 text-center text-sm font-semibold ${status.tone}`}>{status.text}</p>
            ) : (
              <a href={`/rsvp/${token}`} className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-ink text-sm font-bold text-white">
                RSVP: let us know if you’re coming
              </a>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
