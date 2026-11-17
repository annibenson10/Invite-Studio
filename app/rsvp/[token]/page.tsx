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
  const preselect = query.r === "yes" || query.r === "no" ? query.r : null;

  return (
    <main className="grid min-h-screen place-items-center bg-[#eef1f4] p-4 text-[#10213d]">
      <section className="w-full max-w-[560px] rounded-[28px] bg-white px-6 py-10 text-center shadow-[0_18px_55px_rgba(16,33,61,.10)] sm:px-12 sm:py-12">
        {invitation ? (
          <>
            {invitation.flyerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invitation.flyerUrl} alt="" className="mx-auto mb-6 max-h-56 rounded-xl object-contain" />
            )}
            <RsvpForm
              token={token}
              guestName={invitation.guestName}
              eventName={invitation.eventName}
              initialResponse={invitation.rsvp}
              preselect={preselect}
            />
            <a href={`/t/${token}`} className="mt-8 inline-block text-sm font-semibold text-[#c45d0b] underline underline-offset-4">
              View my ticket
            </a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Invitation not found</h1>
            <p className="mt-3 text-slate-500">This RSVP link is not valid. Please check the message you received, or contact the organiser.</p>
          </>
        )}
      </section>
    </main>
  );
}
