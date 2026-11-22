"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, LogOut, MessageSquareText, MoreHorizontal, Palette, Pencil, Plus, ScanLine, Smartphone, Users } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/brand";
import { type Tab, useStudio } from "./context";

const NAV: { id: Tab; label: string; short: string; icon: typeof Users; desktop: boolean }[] = [
  { id: "guests", label: "Guests", short: "Guests", icon: Users, desktop: true },
  { id: "design", label: "Invitation design", short: "Design", icon: Palette, desktop: true },
  { id: "message", label: "Message & sending", short: "Message", icon: MessageSquareText, desktop: true },
  { id: "preview", label: "Preview", short: "Preview", icon: Smartphone, desktop: false },
  { id: "checkin", label: "Door check-in", short: "Check-in", icon: ScanLine, desktop: true },
];

export const TAB_TITLES: Record<Tab, { title: string; subtitle: string }> = {
  guests: { title: "Guests", subtitle: "Add guests, send invites and follow RSVPs." },
  design: { title: "Invitation design", subtitle: "Your flyer, framing and QR codes." },
  message: { title: "Message & sending", subtitle: "What guests receive and how." },
  preview: { title: "Preview", subtitle: "See exactly what a guest receives." },
  checkin: { title: "Door check-in", subtitle: "Give staff the PIN and watch arrivals." },
};

function EventSwitcher({ variant }: { variant: "sidebar" | "topbar" }) {
  const { events, event, switchEvent, actions } = useStudio();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <button className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left transition hover:border-[#d9d4ca]">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-night text-sm font-bold text-white">{event.name.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink-3">Event</span>
              <span className="block truncate text-sm font-bold">{event.name}</span>
            </span>
            <ChevronsUpDown size={16} className="shrink-0 text-ink-3" />
          </button>
        ) : (
          <button className="flex min-w-0 items-center gap-1.5 rounded-xl px-2 py-1.5 text-left hover:bg-black/5">
            <span className="truncate text-[15px] font-bold">{event.name}</span>
            <ChevronsUpDown size={15} className="shrink-0 text-ink-3" />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 rounded-2xl p-1.5">
        <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-ink-3">Your events</DropdownMenuLabel>
        {events.map((item) => (
          <DropdownMenuItem key={item.id} onSelect={() => switchEvent(item.id)} className="rounded-xl py-2">
            <span className="min-w-0 flex-1 truncate">{item.name}</span>
            {item.id === event.id && <Check size={16} className="text-brand" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={actions.newEvent} className="rounded-xl py-2 font-semibold"><Plus size={16} /> New event</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Sidebar() {
  const { tab, setTab, counts, actions } = useStudio();
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
      <div className="px-2"><Logo /></div>
      <div className="mt-6"><EventSwitcher variant="sidebar" /></div>
      <nav className="mt-6 space-y-1" aria-label="Sections">
        {NAV.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition ${item.desktop ? "" : "xl:hidden"} ${
                active ? "bg-ink text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
            >
              <item.icon size={18} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.id === "guests" && counts.total > 0 && <span className={`text-xs tabular-nums ${active ? "text-white/60" : "text-ink-3"}`}>{counts.total}</span>}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto space-y-1 border-t border-line pt-4">
        <button onClick={actions.newEvent} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"><Plus size={17} /> New event</button>
        <button onClick={actions.signOut} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"><LogOut size={17} /> Sign out</button>
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  const { actions, event } = useStudio();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line/70 bg-canvas/85 px-3 backdrop-blur-xl lg:hidden">
      <Logo compact />
      <div className="min-w-0 flex-1"><EventSwitcher variant="topbar" /></div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="grid size-10 shrink-0 place-items-center rounded-xl hover:bg-black/5" aria-label="Menu"><MoreHorizontal size={20} /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
          <DropdownMenuItem onSelect={() => { const name = window.prompt("Rename this event:", event.name); if (name?.trim() && name.trim() !== event.name) actions.renameEvent(name.trim()); }} className="rounded-xl py-2"><Pencil size={16} /> Rename event</DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.newEvent} className="rounded-xl py-2"><Plus size={16} /> New event</DropdownMenuItem>
          <DropdownMenuItem onSelect={actions.signOut} className="rounded-xl py-2"><LogOut size={16} /> Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

export function BottomNav() {
  const { tab, setTab } = useStudio();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 backdrop-blur-xl lg:hidden" aria-label="Sections">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {NAV.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${active ? "text-ink" : "text-ink-3"}`}
            >
              <span className={`grid h-7 w-12 place-items-center rounded-full transition ${active ? "bg-brand-soft text-brand-ink" : ""}`}>
                <item.icon size={19} strokeWidth={active ? 2.3 : 2} />
              </span>
              {item.short}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Event name (editable) and the current section's title. */
export function PageHeader() {
  const { event, tab, actions, counts } = useStudio();
  const [draft, setDraft] = useState(event.name);
  useEffect(() => setDraft(event.name), [event.name]);
  const { title, subtitle } = TAB_TITLES[tab];

  return (
    <div className="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="group hidden max-w-full items-center gap-2 text-sm font-semibold text-ink-3 lg:flex">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => (draft.trim() && draft.trim() !== event.name ? actions.renameEvent(draft.trim()) : setDraft(event.name))}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            aria-label="Event name"
            size={Math.max(8, draft.length)}
            className="min-w-0 max-w-full truncate rounded-lg bg-transparent px-1 py-0.5 -mx-1 outline-none transition hover:bg-black/5 focus:bg-surface focus:text-ink focus:ring-2 focus:ring-brand/30"
          />
          <Pencil size={13} className="shrink-0 opacity-60" />
        </div>
        <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-[32px] lg:mt-1">{title}</h1>
        <p className="mt-1 hidden text-[15px] text-ink-2 sm:block">{subtitle}</p>
      </div>
      {tab === "guests" && counts.total > 0 && (
        <p className="hidden shrink-0 text-sm text-ink-3 sm:block">
          <span className="font-semibold text-ink">{counts.attending}</span> attending · <span className="font-semibold text-ink">{counts.noReply}</span> awaiting reply
        </p>
      )}
    </div>
  );
}

/** Floating "Add guests" button for phones. */
export function MobileAddButton() {
  const { tab, actions } = useStudio();
  if (tab !== "guests") return null;
  return (
    <button
      onClick={() => actions.openAddGuests("single")}
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-brand pl-5 pr-6 text-[15px] font-bold text-white shadow-[0_12px_30px_-10px_rgba(238,106,31,.9)] transition active:scale-95 sm:hidden"
    >
      <Plus size={20} /> Add guests
    </button>
  );
}
