"use client";

import { Copy, ExternalLink, KeyRound, ScanLine, Trash2, UserCheck } from "lucide-react";
import { formatTime, parseDbTime } from "@/lib/client";
import { useStudio } from "./context";
import { Avatar, Card, CardBody, CardHeader, ProgressBar } from "./ui";

export function CheckinPanel() {
  const { event, origin, counts, guests, actions } = useStudio();
  const link = `${origin}/checkin`;
  const expected = counts.attending || counts.total;
  const recent = guests
    .filter((guest) => guest.checkedInAt)
    .sort((a, b) => (parseDbTime(b.checkedInAt)?.getTime() ?? 0) - (parseDbTime(a.checkedInAt)?.getTime() ?? 0))
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl bg-night p-6 text-white shadow-[var(--shadow-float)] sm:p-8">
        <div className="invite-card absolute inset-0 opacity-70" aria-hidden />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm font-semibold text-white/70"><ScanLine size={17} /> Door check-in</div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.2em] text-white/50">Event PIN</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="font-mono text-[44px] font-bold leading-none tracking-[.18em] sm:text-5xl">{event.checkinPin}</p>
            <div className="flex gap-1.5">
              <button onClick={() => actions.copy(event.checkinPin, "PIN")} className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Copy PIN"><Copy size={17} /></button>
              <button onClick={actions.newPin} className="grid size-10 place-items-center rounded-xl bg-white/10 hover:bg-white/20" aria-label="Create a new PIN"><KeyRound size={17} /></button>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/70">
            Send door staff the link and PIN. They can only scan guests in. They can’t see contact details or change your list.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button onClick={() => actions.copy(`Door check-in for ${event.name}\n${link}\nPIN: ${event.checkinPin}`, "Link and PIN")} className="flex h-12 min-w-0 items-center gap-2 rounded-2xl bg-white/10 px-4 text-left text-sm hover:bg-white/15">
              <Copy size={16} className="shrink-0" /> <span className="truncate font-mono">{link.replace(/^https?:\/\//, "")}</span>
            </button>
            <a href={`/checkin?event=${event.id}`} target="_blank" rel="noreferrer" className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand px-5 text-sm font-bold text-white hover:brightness-110">
              <ExternalLink size={16} /> Open scanner
            </a>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader icon={<UserCheck size={18} />} title="Arrivals" description={`${counts.checkedIn} of ${expected} ${counts.attending ? "attending guests" : "guests"} have arrived. Updates automatically.`} />
        <CardBody>
          <ProgressBar value={counts.checkedIn} total={expected} tone="success" />
          {recent.length ? (
            <ul className="mt-5 divide-y divide-line">
              {recent.map((guest) => (
                <li key={guest.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={guest.name} size={34} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{guest.name}</span>
                  <span className="shrink-0 text-xs text-ink-3">{formatTime(guest.checkedInAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-ink-3">No one has checked in yet. Arrivals will appear here as staff scan them in.</p>
          )}
        </CardBody>
      </Card>

      <Card className="border-danger/20">
        <CardHeader icon={<Trash2 size={18} />} title="Delete this event" description="Permanently removes the event, its guest list, RSVPs and check-ins." />
        <CardBody>
          <button onClick={actions.deleteEvent} className="h-11 rounded-2xl border border-danger/30 px-4 text-sm font-bold text-danger hover:bg-danger-soft">
            Delete event…
          </button>
        </CardBody>
      </Card>
    </div>
  );
}
