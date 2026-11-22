"use client";

import { FormEvent, useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Plus, UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelectOption } from "@/components/ui/native-select";
import { EMAIL_PATTERN, normalisePhone, splitPhone } from "@/lib/country-codes";
import type { Guest } from "@/lib/invite";
import { useStudio } from "./context";
import { CategorySelect, CountrySelect, Field, PlainSelect, Segmented, TextInput, Toggle } from "./ui";

const dialogClass = "max-h-[92dvh] overflow-y-auto rounded-3xl border-line p-6 sm:max-w-lg";
const primary = "flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-[15px] font-bold text-white transition hover:bg-black disabled:opacity-40";
const secondary = "flex h-12 items-center justify-center rounded-2xl border border-line px-5 text-[15px] font-semibold hover:bg-surface-2";

export function AddGuestsDialog({ open, mode, onOpenChange, onModeChange }: { open: boolean; mode: "single" | "upload"; onOpenChange: (open: boolean) => void; onModeChange: (mode: "single" | "upload") => void }) {
  const { settings, updateSettings, actions, busy } = useStudio();
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("Guest");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setError("");
  }, [open, mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const whatsapp = normalisePhone(number, settings.defaultCountryCode);
    if (!trimmed) return setError("Enter the guest’s name.");
    if (whatsapp === null) return setError("That WhatsApp number doesn’t look right. Check the digits.");
    if (cleanEmail && !EMAIL_PATTERN.test(cleanEmail)) return setError("That email address doesn’t look right.");
    if (!whatsapp && !cleanEmail) return setError("Add a WhatsApp number or an email address.");
    setSaving(true);
    const ok = await actions.addGuest({ name: trimmed, whatsapp, email: cleanEmail, category });
    setSaving(false);
    if (ok) {
      setName("");
      setNumber("");
      setEmail("");
      setCategory("Guest");
      setError("");
      document.getElementById("add-guest-name")?.focus();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-bold tracking-tight">Add guests</DialogTitle>
          <DialogDescription>Each guest gets a personal ticket, QR code and RSVP link.</DialogDescription>
        </DialogHeader>
        <Segmented
          label="How to add guests"
          value={mode}
          onChange={onModeChange}
          options={[
            { value: "single", label: "One at a time", icon: <Plus size={15} /> },
            { value: "upload", label: "Spreadsheet", icon: <FileSpreadsheet size={15} /> },
          ]}
        />

        {mode === "single" ? (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Full name">
              <TextInput id="add-guest-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amara Okafor" autoComplete="off" autoFocus />
            </Field>
            <div className="grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-3">
              <Field label="Country">
                <CountrySelect value={settings.defaultCountryCode} onChange={(code) => updateSettings({ defaultCountryCode: code })} />
              </Field>
              <Field label="WhatsApp number">
                <TextInput value={number} onChange={(e) => setNumber(e.target.value)} inputMode="tel" placeholder="803 555 0147" autoComplete="off" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <Field label="Email (optional)">
                <TextInput value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="guest@example.com" autoComplete="off" />
              </Field>
              <Field label="Category">
                <CategorySelect value={category} onChange={setCategory} />
              </Field>
            </div>
            {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{error}</p>}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => onOpenChange(false)} className={secondary}>Done</button>
              <button type="submit" disabled={saving} className={primary}>
                {saving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Add guest
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <button onClick={actions.pickGuestFile} disabled={busy} className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-[#d9d4ca] bg-surface-2 px-6 py-8 text-center transition hover:border-brand hover:bg-brand-soft/40 disabled:opacity-60">
              <span className="grid size-12 place-items-center rounded-2xl bg-surface text-brand shadow-sm">{busy ? <Loader2 className="animate-spin" /> : <UploadCloud />}</span>
              <span className="font-bold">Choose an Excel or CSV file</span>
              <span className="text-sm text-ink-2">Guests already on the list are skipped automatically.</span>
            </button>
            <div className="rounded-2xl border border-line p-4 text-sm">
              <p className="font-semibold">Your first row should have these column names:</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["Name", "WhatsApp Number", "Email", "Category"].map((column, index) => (
                  <span key={column} className="rounded-lg bg-[#f0ede7] px-2.5 py-1 font-mono text-xs font-semibold">
                    {column}
                    {index > 1 && <span className="font-sans font-normal text-ink-3"> (optional)</span>}
                  </span>
                ))}
              </div>
              <p className="mt-3 leading-6 text-ink-2">Each guest needs a WhatsApp number or an email address.</p>
              <button onClick={actions.downloadTemplate} className="mt-2 flex items-center gap-1.5 font-semibold text-brand-ink hover:underline">
                <Download size={15} /> Download a ready-made template
              </button>
            </div>
            <Field label="Numbers without a country code are treated as" hint="For example, 0803 555 0147 becomes +234 803 555 0147.">
              <CountrySelect value={settings.defaultCountryCode} onChange={(code) => updateSettings({ defaultCountryCode: code })} label="Default country code" />
            </Field>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type GuestEdits = { name: string; whatsapp: string; email: string; category: string; rsvp: "yes" | "no" | null; checkedIn: boolean; sent: boolean };

export function EditGuestDialog({ guest, onClose, onSave }: { guest: Guest | null; onClose: () => void; onSave: (id: string, edits: GuestEdits) => Promise<boolean> }) {
  const { settings } = useStudio();
  const [draft, setDraft] = useState({ name: "", countryCode: "+234", number: "", email: "", category: "Guest", rsvp: "" as "" | "yes" | "no", checkedIn: false, sent: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!guest) return;
    const [countryCode, number] = guest.whatsapp ? splitPhone(guest.whatsapp) : [settings.defaultCountryCode, ""];
    setDraft({ name: guest.name, countryCode, number, email: guest.email, category: guest.category, rsvp: guest.rsvp ?? "", checkedIn: Boolean(guest.checkedInAt), sent: Boolean(guest.sentAt) });
    setError("");
    // Reset only when a different guest is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guest?.id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!guest) return;
    const name = draft.name.trim();
    const email = draft.email.trim().toLowerCase();
    const whatsapp = normalisePhone(draft.number, draft.countryCode);
    if (!name) return setError("Guest name can’t be empty.");
    if (whatsapp === null) return setError("That WhatsApp number doesn’t look right.");
    if (email && !EMAIL_PATTERN.test(email)) return setError("That email address doesn’t look right.");
    if (!whatsapp && !email) return setError("Add a WhatsApp number or an email address.");
    setSaving(true);
    const ok = await onSave(guest.id, { name, whatsapp, email, category: draft.category, rsvp: draft.rsvp || null, checkedIn: draft.checkedIn, sent: draft.sent });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Dialog open={Boolean(guest)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={dialogClass}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-bold tracking-tight">Edit guest</DialogTitle>
          <DialogDescription>Update details, or correct an RSVP or check-in by hand.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name"><TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <div className="grid grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-3">
            <Field label="Country"><CountrySelect value={draft.countryCode} onChange={(code) => setDraft({ ...draft, countryCode: code })} /></Field>
            <Field label="WhatsApp number"><TextInput value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} inputMode="tel" placeholder="803 555 0147" /></Field>
          </div>
          <Field label="Email"><TextInput value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} type="email" placeholder="guest@example.com" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><CategorySelect value={draft.category} onChange={(category) => setDraft({ ...draft, category })} /></Field>
            <Field label="RSVP">
              <PlainSelect label="RSVP" value={draft.rsvp} onChange={(value) => setDraft({ ...draft, rsvp: value as "" | "yes" | "no" })}>
                <NativeSelectOption value="">No reply</NativeSelectOption>
                <NativeSelectOption value="yes">Attending</NativeSelectOption>
                <NativeSelectOption value="no">Declined</NativeSelectOption>
              </PlainSelect>
            </Field>
          </div>
          <div className="divide-y divide-line rounded-2xl border border-line">
            <div className="flex items-center justify-between gap-3 p-3.5"><span className="text-sm font-semibold">Invite sent</span><Toggle checked={draft.sent} onChange={(sent) => setDraft({ ...draft, sent })} label="Invite sent" /></div>
            <div className="flex items-center justify-between gap-3 p-3.5"><span className="text-sm font-semibold">Checked in at the door</span><Toggle checked={draft.checkedIn} onChange={(checkedIn) => setDraft({ ...draft, checkedIn })} label="Checked in" /></div>
          </div>
          {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">{error}</p>}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className={secondary}>Cancel</button>
            <button type="submit" disabled={saving} className={primary}>{saving && <Loader2 size={17} className="animate-spin" />} Save changes</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewEventDialog({ open, onOpenChange, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const ok = await onCreate(name.trim());
    setSaving(false);
    if (ok) setName("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogClass}>
        <DialogHeader className="text-left">
          <DialogTitle className="text-xl font-bold tracking-tight">New event</DialogTitle>
          <DialogDescription>Each event has its own guest list, flyer, message and door PIN.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Event name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Annual Gala Night" autoFocus /></Field>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => onOpenChange(false)} className={secondary}>Cancel</button>
            <button type="submit" disabled={saving || !name.trim()} className={primary}>{saving ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Create event</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
