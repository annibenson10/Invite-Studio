"use client";

import { createContext, useContext } from "react";
import type { EventInfo, Guest, InviteSettings } from "@/lib/invite";

export type Tab = "guests" | "design" | "message" | "preview" | "checkin";
export type SendMode = "whatsapp" | "email" | "both";
export type NewGuestInput = { name: string; whatsapp: string; email: string; category: string };

export type Counts = { total: number; sent: number; attending: number; declined: number; noReply: number; checkedIn: number };

/** Everything the dashboard panels need: current data plus the actions that change it. */
export type StudioState = {
  origin: string;
  events: EventInfo[];
  event: EventInfo;
  settings: InviteSettings;
  guests: Guest[];
  counts: Counts;
  selected: Guest | null;
  flyerUrl: string | null;
  previewQr: string;
  busy: boolean;
  tab: Tab;
  setTab: (tab: Tab) => void;
  selectGuest: (id: string) => void;
  switchEvent: (id: string) => void;
  updateSettings: (changes: Partial<InviteSettings>) => void;
  actions: {
    pickFlyer: () => void;
    removeFlyer: () => void;
    pickGuestFile: () => void;
    pickQrFiles: () => void;
    addGuest: (guest: NewGuestInput) => Promise<boolean>;
    editGuest: (guest: Guest) => void;
    deleteGuest: (guest: Guest) => void;
    clearGuests: () => void;
    sendInvite: (guest: Guest, mode: SendMode) => void;
    downloadInvite: (guest: Guest) => void;
    copyMessage: (guest: Guest) => void;
    openTicket: (guest: Guest) => void;
    copy: (text: string, label: string) => void;
    exportGuests: () => void;
    downloadTemplate: () => void;
    renameEvent: (name: string) => void;
    newEvent: () => void;
    deleteEvent: () => void;
    newPin: () => void;
    signOut: () => void;
    openAddGuests: (mode?: "single" | "upload") => void;
  };
};

export const StudioContext = createContext<StudioState | null>(null);

export function useStudio() {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudio must be used inside the Studio.");
  return value;
}
