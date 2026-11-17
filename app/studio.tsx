"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import * as XLSX from "xlsx";
import {
  Check, Copy, Download, ExternalLink, FileSpreadsheet, ImagePlus, KeyRound, Link2, LogOut, Mail, MessageCircle,
  Pencil, Plus, QrCode, RefreshCw, ScanLine, Search, Send, Sparkles, Trash2, Upload, UploadCloud, UserCheck, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, formatTime } from "@/lib/client";
import { EMAIL_PATTERN, GUEST_CATEGORIES, allCountries, featuredCountries, formatPhone, normalisePhone, splitPhone } from "@/lib/country-codes";
import {
  type EventInfo, type Guest, type InviteSettings, type Pattern, INVITE_HEIGHT, INVITE_WIDTH, LAYOUT, NAME_MAX_WIDTH, buildMessage, compressFlyer,
  downloadBlob, drawInvite, inviteFilename, loadImage, mergeSettings, needsCustomQr, ticketUrl,
} from "@/lib/invite";

type Filter = "all" | "not_sent" | "attending" | "declined" | "no_reply" | "checked_in";
type GuestDraft = { id: string; name: string; countryCode: string; number: string; email: string; category: string; rsvp: "" | "yes" | "no"; checkedIn: boolean; sent: boolean };

const ORANGE = "bg-[#f58220] text-white hover:bg-[#db6f15]";
const DARK = "bg-[#171512] text-white hover:bg-black";
const pct = (value: number, total: number) => `${(value / total) * 100}%`;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();

function CountrySelect({ value, onChange, label = "Country code", className = "" }: { value: string; onChange: (code: string) => void; label?: string; className?: string }) {
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className={`h-11 rounded-xl border-black/10 bg-white ${className}`}>
      <NativeSelectOptGroup label="Common">
        {featuredCountries.map(([country, code]) => <NativeSelectOption key={`f-${country}`} value={code}>{code} · {country}</NativeSelectOption>)}
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="All countries">
        {allCountries.map(([country, code]) => <NativeSelectOption key={country} value={code}>{code} · {country}</NativeSelectOption>)}
      </NativeSelectOptGroup>
    </NativeSelect>
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = GUEST_CATEGORIES.includes(value as (typeof GUEST_CATEGORIES)[number]) ? GUEST_CATEGORIES : [...GUEST_CATEGORIES, value];
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)} aria-label="Category" className="h-11 rounded-xl border-black/10 bg-white">
      {options.map((option) => <NativeSelectOption key={option} value={option}>{option}</NativeSelectOption>)}
    </NativeSelect>
  );
}

function rowsToGuests(rows: unknown[][], defaultCode: string) {
  if (rows.length < 2) return { guests: [], problems: ["The file has no guest rows."] };
  const headers = rows[0].map((value) => String(value ?? "").trim().toLowerCase());
  const find = (names: string[]) => headers.findIndex((header) => names.includes(header));
  const nameIndex = find(["name", "full name", "guest name", "guest"]);
  const phoneIndex = find(["whatsapp", "whatsapp number", "phone", "phone number", "mobile", "mobile number", "number"]);
  const emailIndex = find(["email", "email address", "e-mail"]);
  const categoryIndex = find(["category", "ticket type", "type"]);
  if (nameIndex < 0 || (phoneIndex < 0 && emailIndex < 0)) {
    return { guests: [], problems: ["The first row needs a Name column and a WhatsApp Number or Email column."] };
  }
  const guests: { name: string; whatsapp: string; email: string; category: string }[] = [];
  const problems: string[] = [];
  rows.slice(1).forEach((row, index) => {
    if (!row.some((cell) => String(cell ?? "").trim())) return;
    const line = index + 2;
    const name = String(row[nameIndex] ?? "").trim();
    const phone = phoneIndex >= 0 ? normalisePhone(String(row[phoneIndex] ?? ""), defaultCode) : "";
    const email = emailIndex >= 0 ? String(row[emailIndex] ?? "").trim().toLowerCase() : "";
    const category = categoryIndex >= 0 ? String(row[categoryIndex] ?? "").trim() || "Guest" : "Guest";
    if (!name) return problems.push(`Row ${line}: missing name`);
    if (phone === null) return problems.push(`Row ${line} (${name}): WhatsApp number not valid`);
    if (email && !EMAIL_PATTERN.test(email)) return problems.push(`Row ${line} (${name}): email not valid`);
    if (!phone && !email) return problems.push(`Row ${line} (${name}): no WhatsApp number or email`);
    guests.push({ name, whatsapp: phone, email, category });
  });
  return { guests, problems };
}

/** Reads a QR image file: returns its decoded text (if readable) and a small PNG copy. */
async function readQrFile(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    const scale = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decoded = jsQR(pixels.data, pixels.width, pixels.height)?.data ?? null;
    return { value: decoded, image: canvas.toDataURL("image/png") };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const normaliseKey = (value: string) => value.toLowerCase().replace(/\.[^.]+$/, "").replace(/[^a-z0-9]/g, "");

export function Studio() {
  const [origin, setOrigin] = useState("");
  const [events, setEvents] = useState<EventInfo[] | null>(null);
  const [eventId, setEventId] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [settings, setSettings] = useState<InviteSettings | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [qr, setQr] = useState("");
  const [qrBust, setQrBust] = useState(0);
  const [notice, setNotice] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [manualName, setManualName] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualCategory, setManualCategory] = useState("Guest");
  const [editing, setEditing] = useState<GuestDraft | null>(null);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [eventNameDraft, setEventNameDraft] = useState("");
  const csvInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const customQrInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number>(0);

  const event = events?.find((item) => item.id === eventId) ?? null;
  const flyerUrl = event && event.flyerVersion > 0 ? `/api/events/${event.id}/flyer?v=${event.flyerVersion}` : null;
  const selected = guests.find((guest) => guest.id === selectedId) ?? guests[0] ?? null;

  const say = (text: string, tone: "info" | "error" = "info") => setNotice({ text, tone });
  const fail = useCallback((error: unknown) => {
    if ((error as { status?: number }).status === 401) {
      window.location.reload();
      return;
    }
    setNotice({ text: error instanceof Error ? error.message : "Something went wrong.", tone: "error" });
  }, []);

  // ---------------------------------------------------------------- loading
  useEffect(() => {
    setOrigin(window.location.origin);
    api<{ events: EventInfo[] }>("/api/events")
      .then(({ events: list }) => {
        setEvents(list);
        let remembered = "";
        try {
          remembered = window.localStorage.getItem("invite-studio-event") ?? "";
        } catch {
          // storage unavailable
        }
        setEventId(list.find((item) => item.id === remembered)?.id ?? list[0]?.id ?? "");
      })
      .catch(fail);
  }, [fail]);

  const loadGuests = useCallback(
    async (id: string) => {
      try {
        const { guests: list } = await api<{ guests: Guest[] }>(`/api/events/${id}/guests`);
        setGuests(list);
      } catch (error) {
        fail(error);
      }
    },
    [fail],
  );

  useEffect(() => {
    if (!eventId || !event) return;
    try {
      window.localStorage.setItem("invite-studio-event", eventId);
    } catch {
      // storage unavailable
    }
    setSettings(mergeSettings(event.name, event.settings));
    setEventNameDraft(event.name);
    setGuests([]);
    setSelectedId("");
    setNotice(null);
    void loadGuests(eventId);
    // Only when switching events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Keep RSVPs and check-ins live while the dashboard is open.
  useEffect(() => {
    if (!eventId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadGuests(eventId);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [eventId, loadGuests]);

  // ---------------------------------------------------------------- settings
  function updateSettings(changes: Partial<InviteSettings>) {
    if (!settings || !event) return;
    const next = { ...settings, ...changes };
    setSettings(next);
    setEvents((list) => list?.map((item) => (item.id === event.id ? { ...item, settings: next } : item)) ?? list);
    window.clearTimeout(saveTimer.current);
    const id = event.id;
    saveTimer.current = window.setTimeout(() => {
      api(`/api/events/${id}`, { method: "PATCH", json: { settings: next } }).catch(fail);
    }, 600);
  }

  function replaceEvent(updated: EventInfo) {
    setEvents((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? list);
  }

  // ---------------------------------------------------------------- QR for preview
  useEffect(() => {
    if (!selected || !settings || !origin) return;
    if (settings.qrMode === "custom") {
      if (selected.customQrValue) {
        QRCode.toDataURL(selected.customQrValue, { width: 260, margin: 1 }).then(setQr).catch(() => setQr(""));
      } else {
        setQr(selected.hasCustomQrImage ? `/api/guests/${selected.id}/qr-image?v=${qrBust}` : "");
      }
      return;
    }
    QRCode.toDataURL(ticketUrl(origin, selected), { width: 260, margin: 1, color: { dark: "#111111", light: "#ffffff" } }).then(setQr);
  }, [selected, settings, origin, qrBust]);

  // ---------------------------------------------------------------- derived
  const counts = useMemo(
    () => ({
      total: guests.length,
      sent: guests.filter((guest) => guest.sentAt).length,
      attending: guests.filter((guest) => guest.rsvp === "yes").length,
      declined: guests.filter((guest) => guest.rsvp === "no").length,
      noReply: guests.filter((guest) => !guest.rsvp).length,
      checkedIn: guests.filter((guest) => guest.checkedInAt).length,
    }),
    [guests],
  );

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

  // ---------------------------------------------------------------- events
  async function createNewEvent() {
    const name = newEventName.trim();
    if (!name) return;
    try {
      const { event: created } = await api<{ event: EventInfo }>("/api/events", { method: "POST", json: { name } });
      setEvents((list) => [created, ...(list ?? [])]);
      setEventId(created.id);
      setNewEventOpen(false);
      setNewEventName("");
    } catch (error) {
      fail(error);
    }
  }

  async function renameEvent() {
    if (!event) return;
    const name = eventNameDraft.trim();
    if (!name || name === event.name) return setEventNameDraft(event.name);
    try {
      const { event: updated } = await api<{ event: EventInfo }>(`/api/events/${event.id}`, { method: "PATCH", json: { name } });
      replaceEvent(updated);
    } catch (error) {
      fail(error);
    }
  }

  async function removeEvent() {
    if (!event) return;
    const typed = window.prompt(`This permanently deletes "${event.name}", its guest list, RSVPs and check-ins.\n\nType the event name to confirm:`);
    if (typed?.trim() !== event.name) return;
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      const remaining = (events ?? []).filter((item) => item.id !== event.id);
      setEvents(remaining);
      setEventId(remaining[0]?.id ?? "");
    } catch (error) {
      fail(error);
    }
  }

  async function newPin() {
    if (!event || !window.confirm("Create a new check-in PIN? Door staff using the old PIN will need the new one.")) return;
    try {
      const { event: updated } = await api<{ event: EventInfo }>(`/api/events/${event.id}/pin`, { method: "POST" });
      replaceEvent(updated);
    } catch (error) {
      fail(error);
    }
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.reload();
  }

  // ---------------------------------------------------------------- flyer
  async function handleImage(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = "";
    if (!file || !event) return;
    setBusy(true);
    say("Uploading flyer…");
    try {
      const blob = await compressFlyer(file);
      const response = await fetch(`/api/events/${event.id}/flyer`, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: blob });
      const data = (await response.json()) as { event?: EventInfo; error?: string };
      if (!response.ok || !data.event) throw Object.assign(new Error(data.error ?? "Upload failed."), { status: response.status });
      replaceEvent(data.event);
      updateSettings({ flyerZoom: 1, flyerX: 50, flyerY: 50 });
      say("Flyer saved.");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------- guests
  async function addGuests(list: { name: string; whatsapp: string; email: string; category: string }[]) {
    const result = await api<{ added: string[]; skipped: string[]; guests: Guest[] }>(`/api/events/${eventId}/guests`, {
      method: "POST",
      json: { guests: list },
    });
    setGuests(result.guests);
    return result;
  }

  async function handleGuestFile(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = "";
    if (!file || !settings) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const { guests: parsed, problems } = rowsToGuests(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }), settings.defaultCountryCode);
      if (!parsed.length) return say(problems[0] ?? "No guests were found in that file.", "error");
      setBusy(true);
      const result = await addGuests(parsed);
      const parts = [`${result.added.length} guest${result.added.length === 1 ? "" : "s"} imported`];
      if (result.skipped.length) parts.push(`${result.skipped.length} already on the list`);
      if (problems.length) parts.push(`${problems.length} row${problems.length === 1 ? "" : "s"} skipped (${problems.slice(0, 3).join("; ")}${problems.length > 3 ? "…" : ""})`);
      say(`${parts.join(", ")}.`, problems.length ? "error" : "info");
      if (result.added[0]) setSelectedId(result.added[0]);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function addManualGuest() {
    if (!settings) return;
    const name = manualName.trim();
    const email = manualEmail.trim().toLowerCase();
    if (!name) return say("Enter the guest’s name before adding them.", "error");
    const whatsapp = normalisePhone(manualNumber, settings.defaultCountryCode);
    if (whatsapp === null) return say("Enter a valid WhatsApp number.", "error");
    if (email && !EMAIL_PATTERN.test(email)) return say("Enter a valid email address or leave it blank.", "error");
    if (!whatsapp && !email) return say("Add a WhatsApp number or email address for the guest.", "error");
    try {
      const result = await addGuests([{ name, whatsapp, email, category: manualCategory }]);
      setSelectedId(result.added[0]);
      setManualName("");
      setManualNumber("");
      setManualEmail("");
      setManualCategory("Guest");
      say(`${name} was added.`);
    } catch (error) {
      fail(error);
    }
  }

  function openEditor(guest: Guest) {
    setNotice(null);
    const [countryCode, number] = guest.whatsapp ? splitPhone(guest.whatsapp) : [settings?.defaultCountryCode ?? "+234", ""];
    setEditing({ id: guest.id, name: guest.name, countryCode, number, email: guest.email, category: guest.category, rsvp: guest.rsvp ?? "", checkedIn: Boolean(guest.checkedInAt), sent: Boolean(guest.sentAt) });
  }

  async function saveGuestEdits() {
    if (!editing) return;
    const name = editing.name.trim();
    const email = editing.email.trim().toLowerCase();
    const whatsapp = normalisePhone(editing.number, editing.countryCode);
    if (!name) return say("Guest name cannot be empty.", "error");
    if (whatsapp === null) return say("Enter a valid WhatsApp number.", "error");
    if (email && !EMAIL_PATTERN.test(email)) return say("Enter a valid email address.", "error");
    if (!whatsapp && !email) return say("Add a WhatsApp number or email address for the guest.", "error");
    try {
      const { guest } = await api<{ guest: Guest }>(`/api/guests/${editing.id}`, {
        method: "PATCH",
        json: { name, whatsapp, email, category: editing.category, rsvp: editing.rsvp || null, checkedIn: editing.checkedIn, sent: editing.sent },
      });
      setGuests((list) => list.map((item) => (item.id === guest.id ? guest : item)));
      setEditing(null);
      say(`${name}'s details were updated.`);
    } catch (error) {
      fail(error);
    }
  }

  async function deleteGuest(guest: Guest) {
    if (!window.confirm(`Delete ${guest.name} from the guest list?`)) return;
    try {
      await api(`/api/guests/${guest.id}`, { method: "DELETE" });
      setGuests((list) => list.filter((item) => item.id !== guest.id));
      say(`${guest.name} was removed from the guest list.`);
    } catch (error) {
      fail(error);
    }
  }

  async function clearGuests() {
    if (!guests.length || !window.confirm(`Remove all ${guests.length} guests, including their RSVPs and check-ins? This cannot be undone.`)) return;
    try {
      await api(`/api/events/${eventId}/guests`, { method: "DELETE" });
      setGuests([]);
      say("The guest list was cleared.");
    } catch (error) {
      fail(error);
    }
  }

  async function handleCustomQrFiles(changeEvent: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(changeEvent.target.files ?? []);
    changeEvent.target.value = "";
    if (!files.length) return;
    setBusy(true);
    let matched = 0;
    let unreadable = 0;
    const unmatched: string[] = [];
    try {
      for (const file of files) {
        const key = normaliseKey(file.name);
        const guest = guests.find((item) =>
          [item.ticketCode, item.name, item.whatsapp, item.whatsapp.replace(/^\+/, "")].map(normaliseKey).some((candidate) => candidate && (key === candidate || key.includes(candidate))),
        );
        if (!guest) {
          unmatched.push(file.name);
          continue;
        }
        const { value, image } = await readQrFile(file);
        if (!value) unreadable += 1;
        await api(`/api/guests/${guest.id}`, { method: "PATCH", json: { customQrValue: value, customQrImage: image } });
        matched += 1;
      }
      updateSettings({ qrMode: "custom" });
      setQrBust((value) => value + 1);
      await loadGuests(eventId);
      const parts = [`${matched} QR code${matched === 1 ? "" : "s"} matched`];
      if (unmatched.length) parts.push(`${unmatched.length} file${unmatched.length === 1 ? "" : "s"} didn’t match a guest (${unmatched.slice(0, 3).join(", ")})`);
      if (unreadable) parts.push(`${unreadable} couldn’t be read, so the door scanner won’t recognise them (search by name instead)`);
      say(`${parts.join("; ")}.`, unmatched.length || unreadable ? "error" : "info");
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------- sending
  async function inviteBlob(guest: Guest) {
    if (!settings || !event) throw new Error("No event selected.");
    return drawInvite({ settings, guest, eventName: event.name, flyerUrl, qrSrc: guest.id === selected?.id ? qr : "" });
  }

  function buildEmailComposeUrl(to: string, message: string) {
    if (!settings) return "";
    const subject = encodeURIComponent(settings.emailSubject);
    const body = encodeURIComponent(message);
    const recipient = encodeURIComponent(to);
    if (settings.emailProvider === "gmail") {
      const authUser = settings.senderEmail.trim() ? `authuser=${encodeURIComponent(settings.senderEmail.trim())}&` : "";
      return `https://mail.google.com/mail/?${authUser}view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`;
    }
    if (settings.emailProvider === "outlook") return `https://outlook.office.com/mail/deeplink/compose?to=${recipient}&subject=${subject}&body=${body}`;
    return `mailto:${to}?subject=${subject}&body=${body}`;
  }

  async function markSentAndAdvance(guest: Guest) {
    try {
      const { guest: updated } = await api<{ guest: Guest }>(`/api/guests/${guest.id}`, { method: "PATCH", json: { sent: true } });
      setGuests((list) => {
        const next = list.map((item) => (item.id === updated.id ? updated : item));
        const index = next.findIndex((item) => item.id === updated.id);
        const following = [...next.slice(index + 1), ...next.slice(0, index)].find((item) => !item.sentAt);
        if (following) setSelectedId(following.id);
        return next;
      });
    } catch (error) {
      fail(error);
    }
  }

  async function sendInvite(mode: "whatsapp" | "email" | "both") {
    if (!selected || !settings) return;
    const guest = selected;
    const phone = guest.whatsapp.replace(/\D/g, "");
    const wantsWhatsapp = mode !== "email";
    const wantsEmail = mode !== "whatsapp";
    if (wantsWhatsapp && !phone) return say(`Add a WhatsApp number for ${guest.name}.`, "error");
    if (wantsEmail && !guest.email) return say(`Add an email address for ${guest.name}.`, "error");
    if (settings.checkInMode === "qr" && !qr) return say(`No QR code is available for ${guest.name}. Upload one or switch to generated QR codes.`, "error");
    const message = buildMessage(settings, guest, origin);
    // Open windows straight away: browsers block pop-ups opened after an await.
    const whatsappWindow = wantsWhatsapp ? window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank") : null;
    if (wantsEmail) window.open(buildEmailComposeUrl(guest.email, message), "_blank");
    setBusy(true);
    try {
      downloadBlob(await inviteBlob(guest), inviteFilename(guest));
      if (wantsWhatsapp && !whatsappWindow) window.location.href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      say(`${mode === "both" ? "WhatsApp and email" : mode === "email" ? "Email" : "WhatsApp"} opened for ${guest.name}. Attach the downloaded flyer, then tap Send. The next unsent guest is now selected.`);
      await markSentAndAdvance(guest);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function downloadInvite() {
    if (!selected) return;
    try {
      downloadBlob(await inviteBlob(selected), inviteFilename(selected));
    } catch (error) {
      fail(error);
    }
  }

  function exportGuests() {
    if (!event) return;
    const rows = guests.map((guest) => ({
      Name: guest.name,
      "WhatsApp number": guest.whatsapp,
      Email: guest.email,
      Category: guest.category,
      "Ticket code": guest.ticketCode,
      "Invite sent": guest.sentAt ? formatTime(guest.sentAt) : "",
      RSVP: guest.rsvp === "yes" ? "Attending" : guest.rsvp === "no" ? "Not attending" : "No reply",
      "RSVP time": formatTime(guest.rsvpAt),
      "Checked in": formatTime(guest.checkedInAt),
      "Ticket link": ticketUrl(origin, guest),
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Guests");
    XLSX.writeFile(workbook, `${event.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}-guests.xlsx`);
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      say(`${label} copied.`);
    } catch {
      window.prompt(`Copy the ${label.toLowerCase()}:`, text);
    }
  }

  // ---------------------------------------------------------------- render: empty states
  if (events === null) {
    return <main className="grid min-h-screen place-items-center bg-[#f4f3ef] text-black/50">{notice?.tone === "error" ? notice.text : "Loading…"}</main>;
  }

  const newEventDialog = (
    <Dialog open={newEventOpen} onOpenChange={setNewEventOpen}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">New event</DialogTitle>
          <DialogDescription>Each event has its own guest list, flyer, message and check-in PIN.</DialogDescription>
        </DialogHeader>
        <Input value={newEventName} onChange={(e) => setNewEventName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createNewEvent()} placeholder="e.g. Annual Gala Night" className="h-11 rounded-xl" autoFocus />
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => setNewEventOpen(false)}>Cancel</Button>
          <Button className={`rounded-xl ${ORANGE}`} onClick={createNewEvent} disabled={!newEventName.trim()}><Plus size={16} /> Create event</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (!event || !settings) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f4f3ef] p-4 text-[#171512]">
        <section className="w-full max-w-md rounded-[26px] border border-black/8 bg-white p-7 text-center shadow-[0_18px_60px_rgba(30,25,18,.08)]">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-[#f58220] text-white"><Sparkles size={22} /></div>
          <h1 className="mt-5 text-2xl font-bold">Create your first event</h1>
          <p className="mt-2 text-sm text-black/55">Give it a name. You can add the flyer and guests next.</p>
          <Input value={newEventName} onChange={(e) => setNewEventName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createNewEvent()} placeholder="e.g. Annual Gala Night" className="mt-6 h-12 rounded-xl" />
          <Button className={`mt-3 h-12 w-full rounded-xl ${ORANGE}`} onClick={createNewEvent} disabled={!newEventName.trim()}><Plus size={16} /> Create event</Button>
          {notice?.tone === "error" && <p className="mt-3 text-sm text-[#a6372f]">{notice.text}</p>}
          <button onClick={signOut} className="mt-6 text-xs text-black/45 underline">Sign out</button>
        </section>
      </main>
    );
  }

  // ---------------------------------------------------------------- render: dashboard
  const message = selected ? buildMessage(settings, selected, origin || "https://your-site") : "";
  // Mirror drawInvite: widen the name band first, then shrink the text (sizes in % of flyer width).
  const nameLength = selected?.name.length ?? 0;
  const estimatedTextWidth = nameLength * 1.75; // ~average uppercase Arial bold glyph width at 2.5cqw
  const bandWidth = Math.min((NAME_MAX_WIDTH / INVITE_WIDTH) * 100, Math.max((LAYOUT.name.w / INVITE_WIDTH) * 100, estimatedTextWidth + 4.3));
  const nameFont = `${Math.max(1.43, 2.5 * Math.min(1, (bandWidth - 2.9) / Math.max(1, estimatedTextWidth)))}cqw`;
  const patternStyle =
    settings.pattern === "dots" ? { backgroundImage: "radial-gradient(#f58220 1.5px, transparent 1.5px)", backgroundSize: "20px 20px" }
    : settings.pattern === "weave" ? { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 18px, rgba(245,130,32,.65) 19px 20px), repeating-linear-gradient(-45deg, transparent 0 18px, rgba(245,130,32,.35) 19px 20px)" }
    : settings.pattern === "diamonds" ? { backgroundImage: "linear-gradient(45deg, transparent 45%, rgba(245,130,32,.65) 46% 54%, transparent 55%), linear-gradient(-45deg, transparent 45%, rgba(245,130,32,.65) 46% 54%, transparent 55%)", backgroundSize: "34px 34px" }
    : {};

  const invitationVisual = (
    <div className="relative aspect-[1122/1402] overflow-hidden rounded-xl bg-[#2a251f] [container-type:inline-size]">
      {flyerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flyerUrl} alt={`${event.name} flyer`} className="absolute inset-0 size-full object-cover" style={{ objectPosition: `${settings.flyerX}% ${settings.flyerY}%`, transform: `scale(${settings.flyerZoom})`, transformOrigin: `${settings.flyerX}% ${settings.flyerY}%` }} />
      ) : (
        <button onClick={() => imageInput.current?.click()} className="invite-card absolute inset-0 flex flex-col items-center px-[8%] pt-[28%] text-center text-white">
          <span className="text-[2.7cqw] font-bold tracking-[.2em] text-[#f58220]">YOU ARE INVITED</span>
          <span className="mt-[3%] text-[6cqw] font-bold uppercase leading-tight">{event.name}</span>
          <span className="mt-[6%] flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[3cqw]"><ImagePlus size={14} /> Upload your flyer</span>
        </button>
      )}
      {settings.pattern !== "none" && <div className="pointer-events-none absolute inset-0 opacity-20" style={patternStyle} />}
      {settings.watermarkEnabled && settings.watermarkText.trim() && (
        <div className="pointer-events-none absolute inset-0 flex -rotate-[28deg] items-center justify-center overflow-hidden" style={{ opacity: settings.watermarkOpacity / 100 }}>
          <span className="whitespace-nowrap text-[3cqw] font-bold tracking-[.2em] text-white">{settings.watermarkText.toUpperCase()}</span>
        </div>
      )}
      {settings.checkInMode === "qr" ? (
        qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={`QR code for ${selected?.name ?? "guest"}`} className="absolute bg-white" style={{ left: pct(LAYOUT.qr.x, INVITE_WIDTH), top: pct(LAYOUT.qr.y, INVITE_HEIGHT), width: pct(LAYOUT.qr.size, INVITE_WIDTH) }} />
        ) : (
          <button className="absolute grid aspect-square place-items-center bg-white text-[1.6cqw] font-bold text-black/45" style={{ left: pct(LAYOUT.qr.x, INVITE_WIDTH), top: pct(LAYOUT.qr.y, INVITE_HEIGHT), width: pct(LAYOUT.qr.size, INVITE_WIDTH) }} onClick={() => customQrInput.current?.click()}>
            UPLOAD<br />QR
          </button>
        )
      ) : (
        <div className="absolute flex flex-col items-center justify-center bg-white/95 text-center text-black" style={{ left: pct(LAYOUT.link.x, INVITE_WIDTH), top: pct(LAYOUT.link.y, INVITE_HEIGHT), width: pct(LAYOUT.link.w, INVITE_WIDTH), height: pct(LAYOUT.link.h, INVITE_HEIGHT) }}>
          <span className="text-[2.2cqw] font-bold">CHECK IN WITH YOUR LINK</span>
          <span className="text-[2cqw] font-semibold text-[#c45d0b]">{selected?.ticketCode}</span>
        </div>
      )}
      {selected && (
        <div className="absolute flex -translate-x-1/2 items-center justify-center overflow-hidden bg-[#230c03]/95" style={{ left: "50%", top: pct(LAYOUT.name.y, INVITE_HEIGHT), width: `${bandWidth}%`, height: pct(LAYOUT.name.h, INVITE_HEIGHT) }}>
          <span className="whitespace-nowrap text-center font-bold uppercase text-[#df7a18]" style={{ fontSize: nameFont }}>{selected.name}</span>
        </div>
      )}
    </div>
  );

  const statusOf = (guest: Guest) =>
    guest.sentAt ? { label: "Sent", dot: "bg-emerald-500", text: "text-emerald-700" }
    : needsCustomQr(settings, guest) ? { label: "Needs QR", dot: "bg-slate-400", text: "text-slate-600" }
    : { label: "Ready", dot: "bg-orange-400", text: "text-[#b75b10]" };

  const sendMode = settings.deliveryMode === "both" ? "both" : "whatsapp";
  const sendLabel = settings.deliveryMode === "both" ? "Open WhatsApp + Email" : "Open WhatsApp invite";

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#171512]">
      <header className="border-b border-black/8 bg-white/90 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f58220] text-white"><Sparkles size={20} /></div>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none">Invite Studio</p>
              <p className="mt-1 text-xs text-black/50">Personalised event delivery</p>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {events.length > 1 && (
              <NativeSelect value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Choose event" className="h-10 max-w-[220px] rounded-xl border-black/10 bg-white">
                {events.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}
              </NativeSelect>
            )}
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => setNewEventOpen(true)}><Plus size={16} /> New event</Button>
            <Button variant="ghost" className="h-10 rounded-xl text-black/60" onClick={signOut} aria-label="Sign out"><LogOut size={16} /><span className="hidden sm:inline">Sign out</span></Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 p-3 sm:p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 overflow-hidden rounded-[26px] border border-black/8 bg-white shadow-[0_18px_60px_rgba(30,25,18,.06)]">
          <div className="flex flex-col gap-4 border-b border-black/8 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <input value={eventNameDraft} onChange={(e) => setEventNameDraft(e.target.value)} onBlur={renameEvent} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} aria-label="Event name" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3 }} className="-mx-1 min-w-0 flex-1 rounded-lg bg-transparent px-1 outline-none hover:bg-black/[.03] focus:bg-black/[.04]" />
                <Pencil size={15} className="shrink-0 text-black/30" />
              </div>
              <p className="mt-1 text-sm text-black/52">Add guests, style the flyer, then send each personalised invite.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={csvInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleGuestFile} />
              <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={handleImage} />
              <Button variant="outline" className="rounded-xl" onClick={() => imageInput.current?.click()} disabled={busy}><ImagePlus size={16} /> Flyer</Button>
              <Button className={`rounded-xl ${DARK}`} onClick={() => csvInput.current?.click()} disabled={busy}><Upload size={16} /> Upload guest list</Button>
            </div>
          </div>

          {notice && (
            <div role="status" className={`mx-4 mt-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm sm:mx-5 ${notice.tone === "error" ? "bg-red-50 text-[#a6372f]" : "bg-[#fff7ed] text-[#9a4c0e]"}`}>
              <Check size={16} className="mt-0.5 shrink-0" /><span className="min-w-0">{notice.text}</span>
              <button onClick={() => setNotice(null)} className="ml-auto shrink-0 text-xs opacity-60 hover:opacity-100" aria-label="Dismiss">✕</button>
            </div>
          )}

          {/* Add guest manually */}
          <div className="mx-4 mt-5 rounded-2xl border border-black/8 bg-[#faf9f6] p-4 sm:mx-5">
            <div className="mb-3">
              <h2 className="text-base font-bold">Add a guest manually</h2>
              <p className="mt-1 text-sm text-black/50">For one guest at a time instead of a spreadsheet. Numbers without a country code use the code selected here.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.15fr_150px_1fr_1.15fr_120px_auto] xl:items-end">
              <label className="block min-w-0"><span className="mb-2 block text-sm font-semibold">Guest name</span><Input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder="e.g. Amara Okafor" className="h-11 rounded-xl border-black/10 bg-white" /></label>
              <label className="block min-w-0 [&_[data-slot=native-select-wrapper]]:w-full"><span className="mb-2 block text-sm font-semibold">Country code</span><CountrySelect value={settings.defaultCountryCode} onChange={(code) => updateSettings({ defaultCountryCode: code })} /></label>
              <label className="block min-w-0"><span className="mb-2 block text-sm font-semibold">WhatsApp number</span><Input value={manualNumber} onChange={(e) => setManualNumber(e.target.value)} inputMode="tel" placeholder="803 555 0147" className="h-11 rounded-xl border-black/10 bg-white" /></label>
              <label className="block min-w-0"><span className="mb-2 block text-sm font-semibold">Email address</span><Input value={manualEmail} onChange={(e) => setManualEmail(e.target.value)} type="email" placeholder="guest@example.com" className="h-11 rounded-xl border-black/10 bg-white" /></label>
              <label className="block min-w-0 [&_[data-slot=native-select-wrapper]]:w-full"><span className="mb-2 block text-sm font-semibold">Category</span><CategorySelect value={manualCategory} onChange={setManualCategory} /></label>
              <Button className={`h-11 rounded-xl px-4 ${DARK}`} onClick={addManualGuest}><Plus size={16} /> Add guest</Button>
            </div>
          </div>

          {/* Flyer styling */}
          <div className="mx-4 mt-5 rounded-2xl border border-black/8 bg-[#faf9f6] p-4 sm:mx-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div><h2 className="text-base font-bold">Style the flyer</h2><p className="mt-1 text-sm text-black/50">Fine-tune the uploaded image, then add an optional watermark or subtle pattern.</p></div>
              <Button variant="outline" size="sm" className="rounded-lg bg-white" onClick={() => updateSettings({ flyerZoom: 1, flyerX: 50, flyerY: 50, watermarkEnabled: false, pattern: "none" })}>Reset styling</Button>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-black/8 bg-white p-4">
                <div className="mb-3 flex items-center justify-between"><p className="font-semibold">Image framing</p><span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-bold text-[#c85e0b]">{Math.round(settings.flyerZoom * 100)}%</span></div>
                <label className="block"><span className="mb-2 flex justify-between text-xs font-medium text-black/55"><span>Zoom</span><span>Zoom out · Zoom in</span></span><input type="range" min="1" max="2" step="0.05" value={settings.flyerZoom} onChange={(e) => updateSettings({ flyerZoom: Number(e.target.value) })} className="w-full accent-[#f58220]" /></label>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <label><span className="mb-2 block text-xs font-medium text-black/55">Move left / right</span><input type="range" min="0" max="100" value={settings.flyerX} onChange={(e) => updateSettings({ flyerX: Number(e.target.value) })} className="w-full accent-[#f58220]" /></label>
                  <label><span className="mb-2 block text-xs font-medium text-black/55">Move up / down</span><input type="range" min="0" max="100" value={settings.flyerY} onChange={(e) => updateSettings({ flyerY: Number(e.target.value) })} className="w-full accent-[#f58220]" /></label>
                </div>
              </div>
              <div className="rounded-xl border border-black/8 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div><p className="font-semibold">Light watermark</p><p className="mt-1 text-xs text-black/45">Applied gently across the exported flyer.</p></div>
                  <button onClick={() => updateSettings({ watermarkEnabled: !settings.watermarkEnabled })} className={`relative h-7 w-12 shrink-0 rounded-full transition ${settings.watermarkEnabled ? "bg-[#f58220]" : "bg-black/15"}`} aria-label="Toggle watermark" aria-pressed={settings.watermarkEnabled}><span className={`absolute top-1 size-5 rounded-full bg-white shadow transition ${settings.watermarkEnabled ? "left-6" : "left-1"}`} /></button>
                </div>
                <Input value={settings.watermarkText} onChange={(e) => updateSettings({ watermarkText: e.target.value })} disabled={!settings.watermarkEnabled} placeholder="Watermark text, e.g. your brand name" className="h-10 rounded-lg" />
                <label className="mt-3 block"><span className="mb-2 flex justify-between text-xs font-medium text-black/55"><span>Opacity</span><span>{settings.watermarkOpacity}%</span></span><input type="range" min="3" max="20" value={settings.watermarkOpacity} disabled={!settings.watermarkEnabled} onChange={(e) => updateSettings({ watermarkOpacity: Number(e.target.value) })} className="w-full accent-[#f58220] disabled:opacity-35" /></label>
              </div>
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold">Pattern overlay</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["none", "dots", "weave", "diamonds"] as Pattern[]).map((option) => (
                  <button key={option} onClick={() => updateSettings({ pattern: option })} className={`rounded-xl border p-3 text-left transition ${settings.pattern === option ? "border-[#f58220] bg-orange-50" : "border-black/8 bg-white hover:border-black/20"}`}>
                    <div className={`mb-2 h-8 rounded-md ${option === "none" ? "bg-[#eeeae3]" : "bg-[#25140c]"}`} style={option === "dots" ? { backgroundImage: "radial-gradient(#f58220 1px, transparent 1px)", backgroundSize: "8px 8px" } : option === "weave" ? { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 7px, #f58220 8px 9px), repeating-linear-gradient(-45deg, transparent 0 7px, rgba(245,130,32,.5) 8px 9px)" } : option === "diamonds" ? { backgroundImage: "linear-gradient(45deg, transparent 42%, #f58220 43% 57%, transparent 58%), linear-gradient(-45deg, transparent 42%, #f58220 43% 57%, transparent 58%)", backgroundSize: "14px 14px" } : {}} />
                    <span className="text-xs font-semibold capitalize">{option}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* QR source */}
          <div className="mx-4 mt-5 rounded-2xl border border-black/8 bg-[#faf9f6] p-4 sm:mx-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div><h2 className="text-base font-bold">Choose QR code source</h2><p className="mt-1 text-sm text-black/50">Generated codes work with the built-in door scanner. Uploaded codes work if they can be read.</p></div>
              {settings.qrMode === "custom" && <Badge variant="outline" className="shrink-0 rounded-full border-black/10">{guests.filter((guest) => guest.hasCustomQrImage || guest.customQrValue).length}/{guests.length} matched</Badge>}
            </div>
            <RadioGroup value={settings.qrMode} onValueChange={(value) => updateSettings({ qrMode: value as InviteSettings["qrMode"] })} className="grid gap-3 md:grid-cols-2">
              <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${settings.qrMode === "automatic" ? "border-[#f58220] bg-orange-50" : "border-black/10 bg-white hover:border-black/20"}`}>
                <RadioGroupItem value="automatic" className="mt-1" />
                <div><p className="font-semibold">Generate QR codes</p><p className="mt-1 text-sm leading-5 text-black/50">A unique, unguessable ticket code for every guest.</p></div>
              </label>
              <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${settings.qrMode === "custom" ? "border-[#f58220] bg-orange-50" : "border-black/10 bg-white hover:border-black/20"}`}>
                <RadioGroupItem value="custom" className="mt-1" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Upload customised QR codes</p>
                  <p className="mt-1 text-sm leading-5 text-black/50">Name each image file after the guest’s ticket code, name or WhatsApp number.</p>
                  <input ref={customQrInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleCustomQrFiles} />
                  <Button type="button" variant="outline" size="sm" className="mt-3 rounded-lg bg-white" disabled={busy} onClick={(e) => { e.preventDefault(); customQrInput.current?.click(); }}><UploadCloud size={15} /> Upload QR images</Button>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Message & delivery */}
          <div className="mx-4 mt-4 rounded-2xl border border-black/8 bg-[#faf9f6] p-4 sm:mx-5">
            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold">Send invitation via</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => { updateSettings({ deliveryMode: "whatsapp" }); setChannel("whatsapp"); }} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition ${settings.deliveryMode === "whatsapp" ? "border-[#1f9d55] bg-[#eaf8ef] text-[#167a3f]" : "border-black/10 bg-white text-black/55"}`}><MessageCircle size={16} className="shrink-0" /> WhatsApp only</button>
                  <button onClick={() => updateSettings({ deliveryMode: "both" })} className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition ${settings.deliveryMode === "both" ? "border-[#f58220] bg-orange-50 text-[#a94d08]" : "border-black/10 bg-white text-black/55"}`}><Send size={16} className="shrink-0" /> WhatsApp + Email</button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Check-in method</p>
                <div className="grid grid-cols-2 rounded-xl bg-black/[.04] p-1">
                  <button onClick={() => updateSettings({ checkInMode: "qr" })} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${settings.checkInMode === "qr" ? "bg-white text-[#c85e0b] shadow-sm" : "text-black/50"}`}><QrCode size={16} /> QR code</button>
                  <button onClick={() => updateSettings({ checkInMode: "link" })} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${settings.checkInMode === "link" ? "bg-white text-[#c85e0b] shadow-sm" : "text-black/50"}`}><Link2 size={16} /> Ticket link</button>
                </div>
              </div>
            </div>
            {settings.deliveryMode === "both" && (
              <div className="mb-4 flex items-center justify-between gap-2 rounded-xl border border-black/8 bg-white p-2">
                <span className="pl-2 text-xs font-semibold text-black/50">Edit &amp; preview</span>
                <div className="flex rounded-lg bg-black/[.04] p-1">
                  <button onClick={() => setChannel("whatsapp")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${channel === "whatsapp" ? "bg-white text-[#167a3f] shadow-sm" : "text-black/45"}`}><MessageCircle size={14} /> WhatsApp</button>
                  <button onClick={() => setChannel("email")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${channel === "email" ? "bg-white text-[#c85e0b] shadow-sm" : "text-black/45"}`}><Mail size={14} /> Email</button>
                </div>
              </div>
            )}
            <div className="mb-3">
              <h2 className="text-base font-bold">{channel === "email" ? "Email invitation" : "Invitation message"}</h2>
              <p className="mt-1 text-sm text-black/50">Use <span className="font-mono text-xs">{"{name}"}</span> for the guest’s name. Their personal RSVP and ticket links are added automatically.</p>
            </div>
            {channel === "email" && settings.deliveryMode === "both" && (
              <div className="mb-4 rounded-xl border border-black/8 bg-white p-4">
                <p className="font-semibold">Email sending account</p>
                <p className="mt-1 text-xs leading-5 text-black/45">Choose where the email should open. You must already be signed in to that account.</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="min-w-0 [&_[data-slot=native-select-wrapper]]:w-full"><span className="mb-2 block text-sm font-semibold">Open email with</span>
                    <NativeSelect value={settings.emailProvider} onChange={(e) => updateSettings({ emailProvider: e.target.value as InviteSettings["emailProvider"] })} className="h-11 rounded-xl border-black/10 bg-white">
                      <NativeSelectOption value="gmail">Gmail on the web</NativeSelectOption>
                      <NativeSelectOption value="outlook">Outlook on the web</NativeSelectOption>
                      <NativeSelectOption value="default">Default email application</NativeSelectOption>
                    </NativeSelect>
                  </label>
                  <label className="min-w-0"><span className="mb-2 block text-sm font-semibold">Send from email address</span><Input value={settings.senderEmail} onChange={(e) => updateSettings({ senderEmail: e.target.value })} type="email" placeholder="you@company.com" className="h-11 rounded-xl border-black/10 bg-white" /></label>
                  <label className="min-w-0 md:col-span-2"><span className="mb-2 block text-sm font-semibold">Email subject</span><Input value={settings.emailSubject} onChange={(e) => updateSettings({ emailSubject: e.target.value })} className="h-11 rounded-xl border-black/10 bg-white" /></label>
                </div>
              </div>
            )}
            <label htmlFor="message-template" className="mb-2 block text-sm font-semibold">Write message</label>
            <Textarea id="message-template" value={settings.messageTemplate} onChange={(e) => updateSettings({ messageTemplate: e.target.value })} className="min-h-36 resize-y rounded-xl border-black/10 bg-white text-base leading-6" />
            <div className="mt-3 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs leading-5 text-black/48">Opens with {selected?.name ?? "the selected guest"}’s message ready and downloads their flyer. Attach it, then tap Send. The next unsent guest is selected automatically.</p>
              <Button disabled={busy || !selected} className={`shrink-0 rounded-xl text-white disabled:opacity-55 ${sendMode === "both" ? ORANGE : "bg-[#1f9d55] hover:bg-[#188448]"}`} onClick={() => sendInvite(sendMode)}><Send size={16} /> {busy ? "Preparing…" : sendLabel}</Button>
            </div>
          </div>

          {/* Guest list */}
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35" size={17} /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guests" className="h-11 rounded-xl border-black/10 bg-[#f7f6f2] pl-10" /></div>
            <div className="flex flex-wrap items-center gap-2">
              <NativeSelect value={filter} onChange={(e) => setFilter(e.target.value as Filter)} aria-label="Filter guests" className="h-10 rounded-xl border-black/10 bg-white">
                <NativeSelectOption value="all">All guests ({counts.total})</NativeSelectOption>
                <NativeSelectOption value="not_sent">Not sent yet ({counts.total - counts.sent})</NativeSelectOption>
                <NativeSelectOption value="attending">Attending ({counts.attending})</NativeSelectOption>
                <NativeSelectOption value="declined">Not attending ({counts.declined})</NativeSelectOption>
                <NativeSelectOption value="no_reply">No reply ({counts.noReply})</NativeSelectOption>
                <NativeSelectOption value="checked_in">Checked in ({counts.checkedIn})</NativeSelectOption>
              </NativeSelect>
              <Button variant="outline" className="h-10 rounded-xl" onClick={exportGuests} disabled={!guests.length}><FileSpreadsheet size={16} /> Export</Button>
              <Button variant="ghost" className="h-10 rounded-xl text-black/50 hover:text-red-600" onClick={clearGuests} disabled={!guests.length} aria-label="Clear guest list"><Trash2 size={16} /></Button>
            </div>
          </div>
          <div className="overflow-x-auto px-2 pb-3 md:px-5">
            {guests.length === 0 ? (
              <div className="m-3 rounded-2xl border border-dashed border-black/15 p-8 text-center text-sm text-black/50">
                <Users className="mx-auto mb-2 text-black/30" />No guests yet. Upload an Excel or CSV guest list, or add guests manually above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-black/8 hover:bg-transparent">
                    <TableHead>Guest</TableHead><TableHead>Category</TableHead><TableHead>Ticket</TableHead><TableHead>Invite</TableHead><TableHead>RSVP</TableHead><TableHead>Check-in</TableHead><TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((guest) => {
                    const status = statusOf(guest);
                    return (
                      <TableRow key={guest.id} onClick={() => setSelectedId(guest.id)} className={`cursor-pointer border-black/7 ${selected?.id === guest.id ? "bg-orange-50/70" : "hover:bg-black/[.025]"}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#ebe8e1] text-xs font-bold">{initials(guest.name)}</div>
                            <div className="min-w-0"><p className="font-semibold">{guest.name}</p><p className="text-xs text-black/45">{formatPhone(guest.whatsapp) || guest.email}</p>{guest.whatsapp && guest.email && <p className="text-[11px] text-black/35">{guest.email}</p>}</div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="rounded-full border-black/10 font-medium">{guest.category}</Badge></TableCell>
                        <TableCell className="font-mono text-xs text-black/55">{guest.ticketCode}</TableCell>
                        <TableCell><span className={`inline-flex items-center gap-2 text-sm font-medium ${status.text}`}><span className={`size-2 rounded-full ${status.dot}`} />{status.label}</span></TableCell>
                        <TableCell>
                          {guest.rsvp === "yes" ? <Badge className="rounded-full bg-[#eaf8ef] text-[#167a3f] hover:bg-[#eaf8ef]">Attending</Badge>
                            : guest.rsvp === "no" ? <Badge className="rounded-full bg-red-50 text-[#a6372f] hover:bg-red-50">Not attending</Badge>
                            : <span className="text-xs text-black/40">No reply</span>}
                        </TableCell>
                        <TableCell className="text-xs">{guest.checkedInAt ? <span className="font-semibold text-[#167a3f]">✓ {formatTime(guest.checkedInAt)}</span> : <span className="text-black/35">Not yet</span>}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={(e) => { e.stopPropagation(); openEditor(guest); }} aria-label={`Edit ${guest.name}`} title="Edit guest" className="rounded-lg p-2 text-black/45 hover:bg-orange-50 hover:text-[#c85e0b]"><Pencil size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); deleteGuest(guest); }} aria-label={`Delete ${guest.name}`} title="Delete guest" className="rounded-lg p-2 text-black/45 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {guests.length > 0 && filtered.length === 0 && <p className="p-6 text-center text-sm text-black/45">No guests match this search or filter.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-black/8 bg-[#faf9f6] p-4 sm:grid-cols-3 sm:p-5 xl:grid-cols-6">
            {([
              [Users, counts.total, "Guests"],
              [Send, counts.sent, "Invites sent"],
              [Check, counts.attending, "Attending"],
              [Trash2, counts.declined, "Not attending"],
              [RefreshCw, counts.noReply, "No reply"],
              [UserCheck, counts.checkedIn, "Checked in"],
            ] as const).map(([Icon, value, label]) => (
              <div className="flex items-center gap-3" key={label}>
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white shadow-sm"><Icon size={18} /></div>
                <div><p className="text-xl font-bold">{value}</p><p className="text-xs text-black/45">{label}</p></div>
              </div>
            ))}
          </div>
        </section>

        {/* Preview & check-in panel */}
        <aside className="min-w-0 space-y-4">
          <div className="rounded-[26px] bg-[#171512] p-4 text-white shadow-[0_24px_70px_rgba(25,20,14,.18)] md:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-lg font-bold">{channel === "email" ? "Email preview" : "WhatsApp preview"}</p><p className="text-xs text-white/45">{settings.checkInMode === "qr" ? "Flyer with QR check-in" : "Flyer with ticket link"} and RSVP</p></div>
              <Badge className={`rounded-full ${channel === "email" ? "bg-orange-400/15 text-orange-200" : "bg-[#1f9d55]/20 text-[#8ce5ad]"}`}>{channel === "email" ? <Mail size={13} /> : <MessageCircle size={13} />} Live</Badge>
            </div>
            {!selected ? (
              <div className="rounded-[22px] bg-white/5 p-4">{invitationVisual}<p className="mt-3 text-center text-sm text-white/50">Add a guest to see their personalised invite.</p></div>
            ) : channel === "whatsapp" ? (
              <div className="overflow-hidden rounded-[22px] bg-[#d9e8df] text-[#171512] shadow-inner">
                <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold">{initials(selected.name)}</div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{selected.name}</p><p className="text-[11px] text-white/70">{formatPhone(selected.whatsapp) || "WhatsApp number required"}</p></div>
                </div>
                <div className="p-3">
                  <div className="ml-auto max-w-[95%] rounded-2xl rounded-tr-sm bg-[#dcf8c6] p-2 shadow-sm">
                    {invitationVisual}
                    <p className="whitespace-pre-wrap break-words px-1 pb-1 pt-3 text-[13px] leading-5 text-[#1f2c25]">{message}</p>
                    <div className="flex justify-end px-1 text-[10px] text-black/40">Preview · ✓✓</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[22px] bg-[#f1f3f5] text-[#171512] shadow-inner">
                <div className="border-b bg-white px-4 py-3">
                  <p className="text-[11px] text-black/40">From: {settings.senderEmail || (settings.emailProvider === "gmail" ? "Selected Gmail account" : settings.emailProvider === "outlook" ? "Selected Outlook account" : "Default mail account")}</p>
                  <p className="text-[11px] text-black/40">To: {selected.email || "Email address required"}</p>
                  <p className="mt-1 truncate text-sm font-bold">{settings.emailSubject}</p>
                </div>
                <div className="p-3"><div className="overflow-hidden rounded-xl bg-white shadow-sm">{invitationVisual}<p className="whitespace-pre-wrap break-words p-4 text-[13px] leading-5 text-black/70">{message}</p></div></div>
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => imageInput.current?.click()} disabled={busy}><ImagePlus size={16} /> {flyerUrl ? "Change flyer" : "Add flyer"}</Button>
              <Button className={`rounded-xl ${ORANGE}`} onClick={downloadInvite} disabled={!selected}><Download size={16} /> Download PNG</Button>
            </div>
            {selected && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => copy(buildMessage(settings, selected, origin), "Message")}><Copy size={16} /> Copy message</Button>
                <Button variant="outline" className="rounded-xl border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => window.open(ticketUrl(origin, selected), "_blank")}><ExternalLink size={16} /> Guest’s ticket</Button>
              </div>
            )}
          </div>

          <div className="rounded-[26px] border border-black/8 bg-white p-5 shadow-[0_18px_60px_rgba(30,25,18,.06)]">
            <div className="flex items-center gap-2"><ScanLine size={18} className="text-[#f58220]" /><h2 className="text-base font-bold">Door check-in</h2></div>
            <p className="mt-1 text-sm text-black/50">Door staff open the check-in page on their phone and enter this PIN. They can only scan guests in, not see or change your list.</p>
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#faf9f6] p-3">
              <div><p className="text-[11px] font-semibold uppercase tracking-wider text-black/45">Event PIN</p><p className="font-mono text-2xl font-bold tracking-[.25em]">{event.checkinPin}</p></div>
              <div className="flex gap-1">
                <button onClick={() => copy(event.checkinPin, "PIN")} className="rounded-lg p-2 text-black/50 hover:bg-black/5" aria-label="Copy PIN" title="Copy PIN"><Copy size={16} /></button>
                <button onClick={newPin} className="rounded-lg p-2 text-black/50 hover:bg-black/5" aria-label="New PIN" title="Create a new PIN"><KeyRound size={16} /></button>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-[#faf9f6] p-3 text-sm">
              <span className="min-w-0 truncate font-mono text-xs text-black/60">{origin}/checkin</span>
              <button onClick={() => copy(`${origin}/checkin`, "Check-in link")} className="shrink-0 rounded-lg p-1.5 text-black/50 hover:bg-black/5" aria-label="Copy check-in link"><Copy size={15} /></button>
            </div>
            <a href={`/checkin?event=${event.id}`} target="_blank" rel="noreferrer" className={`mt-3 flex h-11 items-center justify-center gap-2 rounded-xl font-semibold ${DARK}`}><ScanLine size={16} /> Open scanner</a>
            <p className="mt-3 text-center text-xs text-black/45">{counts.checkedIn} of {counts.attending || counts.total} {counts.attending ? "attending guests" : "guests"} checked in</p>
          </div>

          <div className="px-2 text-center">
            <button onClick={removeEvent} className="text-xs text-black/40 underline underline-offset-4 hover:text-red-600">Delete this event</button>
          </div>
        </aside>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Edit guest</DialogTitle>
            <DialogDescription>Update contact details, or correct an RSVP or check-in by hand.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="grid gap-4 py-2 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Guest name</span><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-11 rounded-xl" /></label>
              <label className="min-w-0 [&_[data-slot=native-select-wrapper]]:w-full"><span className="mb-2 block text-sm font-semibold">Country code</span><CountrySelect value={editing.countryCode} onChange={(code) => setEditing({ ...editing, countryCode: code })} /></label>
              <label><span className="mb-2 block text-sm font-semibold">WhatsApp number</span><Input value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} inputMode="tel" placeholder="803 555 0147" className="h-11 rounded-xl" /></label>
              <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Email address</span><Input value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} type="email" placeholder="guest@example.com" className="h-11 rounded-xl" /></label>
              <label className="min-w-0 [&_[data-slot=native-select-wrapper]]:w-full"><span className="mb-2 block text-sm font-semibold">Category</span><CategorySelect value={editing.category} onChange={(category) => setEditing({ ...editing, category })} /></label>
              <label className="min-w-0 [&_[data-slot=native-select-wrapper]]:w-full"><span className="mb-2 block text-sm font-semibold">RSVP</span>
                <NativeSelect value={editing.rsvp} onChange={(e) => setEditing({ ...editing, rsvp: e.target.value as GuestDraft["rsvp"] })} className="h-11 rounded-xl">
                  <NativeSelectOption value="">No reply</NativeSelectOption>
                  <NativeSelectOption value="yes">Attending</NativeSelectOption>
                  <NativeSelectOption value="no">Not attending</NativeSelectOption>
                </NativeSelect>
              </label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.sent} onChange={(e) => setEditing({ ...editing, sent: e.target.checked })} className="size-4 accent-[#f58220]" /> Invite sent</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.checkedIn} onChange={(e) => setEditing({ ...editing, checkedIn: e.target.checked })} className="size-4 accent-[#f58220]" /> Checked in</label>
            </div>
          )}
          {notice?.tone === "error" && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[#a6372f]">{notice.text}</p>}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setEditing(null)}>Cancel</Button>
            <Button className={`rounded-xl ${ORANGE}`} onClick={saveGuestEdits}><Check size={16} /> Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {newEventDialog}
    </main>
  );
}
