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
  const qrSvg = invitation
    ? await QRCode.toString(`${protocol}://${host}/t/${token}`, { type: "svg", margin: 1, width: 240 })
    : "";

  return (
    <main className="grid min-h-screen place-items-center bg-[#171512] p-4 text-white">
      {invitation ? (
        <section className="w-full max-w-[400px] overflow-hidden rounded-[28px] bg-white text-[#171512] shadow-2xl">
          {invitation.flyerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={invitation.flyerUrl} alt="" className="h-40 w-full object-cover" />
          )}
          <div className="p-6 text-center">
            <p className="text-xs font-bold uppercase tracking-[.2em] text-[#c45d0b]">Admit one</p>
            <h1 className="mt-2 text-2xl font-bold">{invitation.guestName}</h1>
            <p className="mt-1 text-sm text-black/55">{invitation.eventName}</p>
            <div className="mx-auto mt-5 w-56 rounded-xl border border-black/10 p-2 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <p className="mt-3 font-mono text-lg font-bold tracking-widest">{invitation.ticketCode}</p>
            <p className="text-xs text-black/45">{invitation.category}</p>
            <div className="mt-5 rounded-xl bg-[#f4f3ef] px-4 py-3 text-sm">
              {invitation.checkedInAt ? (
                <span className="font-semibold text-[#278237]">✓ Checked in. Enjoy the event!</span>
              ) : invitation.rsvp === "yes" ? (
                <span>Show this QR code at the entrance.</span>
              ) : invitation.rsvp === "no" ? (
                <span>You told us you can’t attend. Contact the organiser if your plans change.</span>
              ) : (
                <a href={`/rsvp/${token}`} className="font-semibold text-[#c45d0b] underline underline-offset-4">
                  Please RSVP: tell us if you’re coming
                </a>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="max-w-sm text-center">
          <h1 className="text-2xl font-bold">Ticket not found</h1>
          <p className="mt-3 text-white/60">This ticket link is not valid. Please contact the organiser.</p>
        </section>
      )}
    </main>
  );
}
