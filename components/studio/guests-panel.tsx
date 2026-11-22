"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2, Copy, Download, ExternalLink, FileSpreadsheet, MoreHorizontal, Pencil, Plus, Search, Send, Trash2, Upload, UserCheck, Users,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTime } from "@/lib/client";
import { formatPhone } from "@/lib/country-codes";
import { type Guest, needsCustomQr } from "@/lib/invite";
import { useStudio } from "./context";
import { Avatar, Card, Pill, ProgressBar } from "./ui";

type Filter = "all" | "not_sent" | "attending" | "declined" | "no_reply" | "checked_in";

export function GuestsPanel() {
  const { guests, counts, actions } = useStudio();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return guests.filter((guest) => {
      if (filter === "not_sent" && guest.sentAt) return false;
      if (filter === "attending" && guest.rsvp !== "yes") return false;
      if (filter === "declined" && guest.rsvp !== "no") return false;
      if (filter === "no_reply" && guest.rsvp) return false;
      if (filter === "checked_in" && !guest.checkedInAt) return false;
      return !term || `${guest.name} ${guest.whatsapp} ${guest.email} ${guest.category} ${guest.ticketCode}`.toLowerCase().includes(term);
    });
  }, [guests, query, filter]);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.total },
    { id: "not_sent", label: "Not sent", count: counts.total - counts.sent },
    { id: "attending", label: "Attending", count: counts.attending },
    { id: "no_reply", label: "No reply", count: counts.noReply },
    { id: "declined", label: "Declined", count: counts.declined },
    { id: "checked_in", label: "Checked in", count: counts.checkedIn },
  ];

  return (
    <div className="space-y-5">
      <Stats />

      <Card>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, number or ticket"
                aria-label="Search guests"
                className="h-11 w-full rounded-2xl border border-line bg-surface-2 pl-10 pr-3 text-[15px] outline-none transition placeholder:text-ink-3 focus:border-brand focus:bg-surface focus:ring-4 focus:ring-brand/15"
              />
            </div>
            <button onClick={() => actions.openAddGuests("single")} className="hidden h-11 shrink-0 items-center gap-2 rounded-2xl bg-ink px-4 text-sm font-bold text-white transition hover:bg-black sm:flex">
              <Plus size={17} /> Add guests
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="grid size-11 shrink-0 place-items-center rounded-2xl border border-line text-ink-2 transition hover:bg-surface-2" aria-label="More guest list options">
                  <MoreHorizontal size={18} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                <DropdownMenuItem onSelect={() => actions.openAddGuests("upload")} className="rounded-xl py-2"><Upload size={16} /> Upload a spreadsheet</DropdownMenuItem>
                <DropdownMenuItem onSelect={actions.exportGuests} disabled={!guests.length} className="rounded-xl py-2"><FileSpreadsheet size={16} /> Export to Excel</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={actions.clearGuests} disabled={!guests.length} className="rounded-xl py-2 text-danger focus:text-danger"><Trash2 size={16} /> Clear guest list</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Filter guests">
            {filters.map((item) => (
              <button
                key={item.id}
                role="tab"
                aria-selected={filter === item.id}
                onClick={() => setFilter(item.id)}
                className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${
                  filter === item.id ? "bg-ink text-white" : "bg-surface-2 text-ink-2 ring-1 ring-inset ring-line hover:text-ink"
                }`}
              >
                {item.label}
                <span className={`tabular-nums ${filter === item.id ? "text-white/60" : "text-ink-3"}`}>{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        {guests.length === 0 ? (
          <EmptyGuests />
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-3">No guests match this search or filter.</p>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] gap-4 border-b border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink-3 2xl:grid">
              <span>Guest</span><span>Invite</span><span>RSVP</span><span>Check-in</span><span className="w-[132px]" />
            </div>
            <ul className="divide-y divide-line">
              {filtered.map((guest) => <GuestRow key={guest.id} guest={guest} />)}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}

function Stats() {
  const { counts } = useStudio();
  const replied = counts.attending + counts.declined;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      <StatCard icon={<Users size={17} />} label="Guests" value={counts.total} sub={counts.total ? `${counts.total - counts.sent} still to send` : "Add your first guest"} />
      <StatCard icon={<Send size={17} />} label="Invites sent" value={counts.sent} of={counts.total} bar={<ProgressBar value={counts.sent} total={counts.total} />} />
      <StatCard
        icon={<CheckCircle2 size={17} />}
        label="Attending"
        value={counts.attending}
        sub={`${replied} of ${counts.total} replied`}
        bar={
          <div className="flex h-2 overflow-hidden rounded-full bg-[#efece6]">
            <div className="bg-success transition-all" style={{ width: `${counts.total ? (counts.attending / counts.total) * 100 : 0}%` }} />
            <div className="bg-danger/70 transition-all" style={{ width: `${counts.total ? (counts.declined / counts.total) * 100 : 0}%` }} />
          </div>
        }
      />
      <StatCard icon={<UserCheck size={17} />} label="Checked in" value={counts.checkedIn} of={counts.attending || counts.total} bar={<ProgressBar value={counts.checkedIn} total={counts.attending || counts.total} tone="success" />} />
    </div>
  );
}

function StatCard({ icon, label, value, of, sub, bar }: { icon: React.ReactNode; label: string; value: number; of?: number; sub?: string; bar?: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-3xl border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-2 sm:text-sm">
        <span className="hidden size-8 place-items-center rounded-xl bg-surface-2 text-ink sm:grid">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold leading-none tracking-tight tabular-nums sm:mt-3 sm:text-[28px]">
        {value}
        {of !== undefined && <span className="text-base font-semibold text-ink-3"> / {of}</span>}
      </p>
      <div className="mt-auto pt-2.5 sm:pt-3">
        {bar}
        {sub && <p className={`text-xs text-ink-3 ${bar ? "mt-2" : ""}`}>{sub}</p>}
      </div>
    </div>
  );
}

function GuestRow({ guest }: { guest: Guest }) {
  const { selected, selectGuest, settings, actions, busy } = useStudio();
  const isSelected = selected?.id === guest.id;
  const needsQr = needsCustomQr(settings, guest);
  const sendMode = settings.deliveryMode === "both" ? "both" : "whatsapp";
  const contact = formatPhone(guest.whatsapp) || guest.email;

  const invite = guest.sentAt ? <Pill tone="success">Sent</Pill> : needsQr ? <Pill tone="neutral">Needs QR</Pill> : <Pill tone="muted">Not sent</Pill>;
  const rsvp = guest.rsvp === "yes" ? <Pill tone="success">Attending</Pill> : guest.rsvp === "no" ? <Pill tone="danger">Declined</Pill> : <Pill tone="muted">No reply</Pill>;
  const checkIn = guest.checkedInAt ? <Pill tone="success"><UserCheck size={12} /> {formatTime(guest.checkedInAt)}</Pill> : <span className="text-xs text-ink-3">Not yet</span>;

  return (
    <li
      onClick={() => selectGuest(guest.id)}
      className={`relative cursor-pointer px-4 py-3.5 transition sm:px-5 ${isSelected ? "bg-brand-soft/50" : "hover:bg-surface-2"}`}
    >
      {isSelected && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand" aria-hidden />}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 2xl:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_auto] 2xl:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={guest.name} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-semibold">
              <span className="truncate">{guest.name}</span>
              {guest.category !== "Guest" && <span className="hidden 2xl:inline-flex"><Pill tone="brand">{guest.category}</Pill></span>}
            </p>
            <p className="truncate text-[13px] text-ink-3">
              {contact}
              <span className="ml-2 font-mono text-[12px] tracking-wider">{guest.ticketCode}</span>
            </p>
          </div>
        </div>

        <div className="hidden 2xl:block">{invite}</div>
        <div className="hidden 2xl:block">{rsvp}</div>
        <div className="hidden 2xl:block">{checkIn}</div>

        <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
          <button
            onClick={() => actions.sendInvite(guest, sendMode)}
            disabled={busy}
            className={`flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition disabled:opacity-50 ${
              guest.sentAt ? "border border-line text-ink-2 hover:bg-surface-2" : "bg-success text-white hover:brightness-110"
            }`}
            aria-label={`${guest.sentAt ? "Resend" : "Send"} invite to ${guest.name}`}
          >
            <Send size={14} /> <span className="hidden sm:inline">{guest.sentAt ? "Resend" : "Send"}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="grid size-9 place-items-center rounded-xl text-ink-3 transition hover:bg-black/5 hover:text-ink" aria-label={`More options for ${guest.name}`}>
                <MoreHorizontal size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
              <DropdownMenuItem onSelect={() => actions.editGuest(guest)} className="rounded-xl py-2"><Pencil size={16} /> Edit guest</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.downloadInvite(guest)} className="rounded-xl py-2"><Download size={16} /> Download invite</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.copyMessage(guest)} className="rounded-xl py-2"><Copy size={16} /> Copy message</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.openTicket(guest)} className="rounded-xl py-2"><ExternalLink size={16} /> Open their ticket</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => actions.deleteGuest(guest)} className="rounded-xl py-2 text-danger focus:text-danger"><Trash2 size={16} /> Delete guest</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Status pills on phones and tablets */}
        <div className="col-span-2 flex flex-wrap items-center gap-1.5 pl-[52px] 2xl:hidden">
          {guest.category !== "Guest" && <Pill tone="brand">{guest.category}</Pill>}
          {invite}
          {rsvp}
          {guest.checkedInAt && checkIn}
        </div>
      </div>
    </li>
  );
}

function EmptyGuests() {
  const { actions } = useStudio();
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand-ink">
        <Users size={24} />
      </div>
      <h3 className="mt-4 text-lg font-bold">No guests yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-ink-2">Upload your guest list from Excel or CSV, or add guests one at a time. Each guest gets their own ticket and QR code.</p>
      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <button onClick={() => actions.openAddGuests("upload")} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-sm font-bold text-white hover:bg-black">
          <Upload size={16} /> Upload a spreadsheet
        </button>
        <button onClick={() => actions.openAddGuests("single")} className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-line px-5 text-sm font-bold hover:bg-surface-2">
          <Plus size={16} /> Add one guest
        </button>
      </div>
    </div>
  );
}
