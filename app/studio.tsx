"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
import * as XLSX from "xlsx";
import { Loader2, Plus } from "lucide-react";
import { Toaster, toast } from "sonner";
import { api, formatTime } from "@/lib/client";
import { EMAIL_PATTERN, normalisePhone } from "@/lib/country-codes";
import {
  type EventInfo, type Guest, type InviteSettings, buildMessage, compressFlyer, downloadBlob, drawInvite, inviteFilename, loadImage,
  mergeSettings, needsCustomQr, ticketUrl,
} from "@/lib/invite";
import { Logo } from "@/components/brand";
import { type NewGuestInput, type SendMode, StudioContext, type StudioState, type Tab } from "@/components/studio/context";
import { GuestsPanel } from "@/components/studio/guests-panel";
import { DesignPanel } from "@/components/studio/design-panel";
import { MessagePanel } from "@/components/studio/message-panel";
import { CheckinPanel } from "@/components/studio/checkin-panel";
import { PreviewPanel } from "@/components/studio/preview";
import { AddGuestsDialog, EditGuestDialog, type GuestEdits, NewEventDialog } from "@/components/studio/dialogs";
import { BottomNav, MobileAddButton, MobileTopBar, PageHeader, Sidebar } from "@/components/studio/shell";

// ---------------------------------------------------------------------------
// Helpers

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
  const guests: NewGuestInput[] = [];
  const problems: string[] = [];
  rows.slice(1).forEach((row, index) => {
    if (!row.some((cell) => String(cell ?? "").trim())) return;
    const line = index + 2;
    const name = String(row[nameIndex] ?? "").trim();
    const phone = phoneIndex >= 0 ? normalisePhone(String(row[phoneIndex] ?? ""), defaultCode) : "";
    const email = emailIndex >= 0 ? String(row[emailIndex] ?? "").trim().toLowerCase() : "";
    const category = categoryIndex >= 0 ? String(row[categoryIndex] ?? "").trim() || "Guest" : "Guest";
    if (!name) return problems.push(`row ${line}: missing name`);
    if (phone === null) return problems.push(`row ${line} (${name}): number not valid`);
    if (email && !EMAIL_PATTERN.test(email)) return problems.push(`row ${line} (${name}): email not valid`);
    if (!phone && !email) return problems.push(`row ${line} (${name}): no number or email`);
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
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

// ---------------------------------------------------------------------------

export function Studio() {
  const [origin, setOrigin] = useState("");
  const [events, setEvents] = useState<EventInfo[] | null>(null);
  const [eventId, setEventId] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [settings, setSettings] = useState<InviteSettings | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [previewQr, setPreviewQr] = useState("");
  const [qrBust, setQrBust] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tab, setTabState] = useState<Tab>("guests");
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"single" | "upload">("single");
  const [editing, setEditing] = useState<Guest | null>(null);
  const [newEventOpen, setNewEventOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const guestFileInput = useRef<HTMLInputElement>(null);
  const flyerInput = useRef<HTMLInputElement>(null);
  const qrInput = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number>(0);

  const event = events?.find((item) => item.id === eventId) ?? null;
  const flyerUrl = event && event.flyerVersion > 0 ? `/api/events/${event.id}/flyer?v=${event.flyerVersion}` : null;
  const selected = guests.find((guest) => guest.id === selectedId) ?? guests[0] ?? null;

  const fail = useCallback((error: unknown) => {
    if ((error as { status?: number }).status === 401) {
      window.location.reload();
      return;
    }
    toast.error(error instanceof Error ? error.message : "Something went wrong.");
  }, []);

  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      .catch((error) => {
        if ((error as { status?: number }).status === 401) return window.location.reload();
        setLoadError(error instanceof Error ? error.message : "Could not load your events.");
      });
  }, []);

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
    setGuests([]);
    setSelectedId("");
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
  const updateSettings = useCallback(
    (changes: Partial<InviteSettings>) => {
      if (!settings || !event) return;
      const next = { ...settings, ...changes };
      setSettings(next);
      setEvents((list) => list?.map((item) => (item.id === event.id ? { ...item, settings: next } : item)) ?? list);
      window.clearTimeout(saveTimer.current);
      const id = event.id;
      saveTimer.current = window.setTimeout(() => {
        api(`/api/events/${id}`, { method: "PATCH", json: { settings: next } }).catch(fail);
      }, 600);
    },
    [settings, event, fail],
  );

  const replaceEvent = (updated: EventInfo) => setEvents((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? list);

  // ---------------------------------------------------------------- QR codes
  const qrFor = useCallback(
    async (guest: Guest) => {
      if (!settings || settings.checkInMode !== "qr") return "";
      if (settings.qrMode === "custom") {
        if (guest.customQrValue) return QRCode.toDataURL(guest.customQrValue, { width: 300, margin: 1 });
        return guest.hasCustomQrImage ? `/api/guests/${guest.id}/qr-image?v=${qrBust}` : "";
      }
      return QRCode.toDataURL(ticketUrl(origin || window.location.origin, guest), { width: 300, margin: 1, color: { dark: "#111111", light: "#ffffff" } });
    },
    [settings, origin, qrBust],
  );

  useEffect(() => {
    if (!selected) return setPreviewQr("");
    let current = true;
    qrFor(selected).then((value) => current && setPreviewQr(value)).catch(() => current && setPreviewQr(""));
    return () => {
      current = false;
    };
  }, [selected, qrFor]);

  // ---------------------------------------------------------------- counts
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

  // ---------------------------------------------------------------- events
  async function createEvent(name: string) {
    try {
      const { event: created } = await api<{ event: EventInfo }>("/api/events", { method: "POST", json: { name } });
      setEvents((list) => [created, ...(list ?? [])]);
      setEventId(created.id);
      setNewEventOpen(false);
      setTabState("guests");
      toast.success(`“${name}” created`);
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  async function renameEvent(name: string) {
    if (!event) return;
    try {
      const { event: updated } = await api<{ event: EventInfo }>(`/api/events/${event.id}`, { method: "PATCH", json: { name } });
      replaceEvent(updated);
      toast.success("Event renamed");
    } catch (error) {
      fail(error);
    }
  }

  async function deleteEvent() {
    if (!event) return;
    const typed = window.prompt(`This permanently deletes "${event.name}", its guest list, RSVPs and check-ins.\n\nType the event name to confirm:`);
    if (typed === null) return;
    if (typed.trim() !== event.name) return void toast.error("The name didn’t match, so nothing was deleted.");
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      const remaining = (events ?? []).filter((item) => item.id !== event.id);
      setEvents(remaining);
      setEventId(remaining[0]?.id ?? "");
      setTabState("guests");
      toast.success("Event deleted");
    } catch (error) {
      fail(error);
    }
  }

  async function newPin() {
    if (!event || !window.confirm("Create a new door PIN? Staff using the old PIN will need the new one.")) return;
    try {
      const { event: updated } = await api<{ event: EventInfo }>(`/api/events/${event.id}/pin`, { method: "POST" });
      replaceEvent(updated);
      toast.success(`New PIN: ${updated.checkinPin}`);
    } catch (error) {
      fail(error);
    }
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.reload();
  }

  // ---------------------------------------------------------------- flyer
  async function handleFlyer(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = "";
    if (!file || !event) return;
    setBusy(true);
    const pending = toast.loading("Uploading flyer…");
    try {
      const blob = await compressFlyer(file);
      const response = await fetch(`/api/events/${event.id}/flyer`, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: blob });
      const data = (await response.json()) as { event?: EventInfo; error?: string };
      if (!response.ok || !data.event) throw Object.assign(new Error(data.error ?? "Upload failed."), { status: response.status });
      replaceEvent(data.event);
      updateSettings({ flyerZoom: 1, flyerX: 50, flyerY: 50 });
      toast.success("Flyer saved", { id: pending });
    } catch (error) {
      toast.dismiss(pending);
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function removeFlyer() {
    if (!event || !window.confirm("Remove the flyer from this event?")) return;
    try {
      const { event: updated } = await api<{ event: EventInfo }>(`/api/events/${event.id}/flyer`, { method: "DELETE" });
      replaceEvent(updated);
    } catch (error) {
      fail(error);
    }
  }

  // ---------------------------------------------------------------- guests
  async function postGuests(list: NewGuestInput[]) {
    const result = await api<{ added: string[]; skipped: string[]; guests: Guest[] }>(`/api/events/${eventId}/guests`, { method: "POST", json: { guests: list } });
    setGuests(result.guests);
    return result;
  }

  async function addGuest(guest: NewGuestInput) {
    try {
      const result = await postGuests([guest]);
      setSelectedId(result.added[0]);
      toast.success(`${guest.name} added`);
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  async function handleGuestFile(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.target.files?.[0];
    changeEvent.target.value = "";
    if (!file || !settings) return;
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const { guests: parsed, problems } = rowsToGuests(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }), settings.defaultCountryCode);
      if (!parsed.length) return void toast.error(problems[0] ?? "No guests were found in that file.");
      const result = await postGuests(parsed);
      const details = [
        result.skipped.length ? `${plural(result.skipped.length, "guest")} already on the list` : "",
        problems.length ? `${plural(problems.length, "row")} skipped: ${problems.slice(0, 3).join("; ")}${problems.length > 3 ? "…" : ""}` : "",
      ].filter(Boolean).join(". ");
      (problems.length ? toast.warning : toast.success)(`${plural(result.added.length, "guest")} imported`, { description: details || undefined, duration: problems.length ? 10000 : 4000 });
      if (result.added[0]) setSelectedId(result.added[0]);
      setAddOpen(false);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  async function saveGuest(id: string, edits: GuestEdits) {
    try {
      const { guest } = await api<{ guest: Guest }>(`/api/guests/${id}`, { method: "PATCH", json: edits });
      setGuests((list) => list.map((item) => (item.id === guest.id ? guest : item)));
      toast.success("Guest updated");
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  async function deleteGuest(guest: Guest) {
    if (!window.confirm(`Delete ${guest.name} from the guest list?`)) return;
    try {
      await api(`/api/guests/${guest.id}`, { method: "DELETE" });
      setGuests((list) => list.filter((item) => item.id !== guest.id));
      toast.success(`${guest.name} removed`);
    } catch (error) {
      fail(error);
    }
  }

  async function clearGuests() {
    if (!guests.length || !window.confirm(`Remove all ${guests.length} guests, including their RSVPs and check-ins? This can’t be undone.`)) return;
    try {
      await api(`/api/events/${eventId}/guests`, { method: "DELETE" });
      setGuests([]);
      toast.success("Guest list cleared");
    } catch (error) {
      fail(error);
    }
  }

  async function handleQrFiles(changeEvent: ChangeEvent<HTMLInputElement>) {
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
      const details = [
        unmatched.length ? `${plural(unmatched.length, "file")} didn’t match a guest (${unmatched.slice(0, 3).join(", ")})` : "",
        unreadable ? `${unreadable} couldn’t be read, so the door scanner won’t recognise them. Staff can search by name instead` : "",
      ].filter(Boolean).join(". ");
      (details ? toast.warning : toast.success)(`${plural(matched, "QR code")} matched`, { description: details || undefined, duration: details ? 10000 : 4000 });
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  }

  // ---------------------------------------------------------------- sending
  function emailComposeUrl(to: string, message: string) {
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

  async function inviteBlob(guest: Guest) {
    if (!settings || !event) throw new Error("No event selected.");
    return drawInvite({ settings, guest, eventName: event.name, flyerUrl, qrSrc: await qrFor(guest) });
  }

  async function markSent(guest: Guest) {
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

  function sendInvite(guest: Guest, requested: SendMode) {
    if (!settings) return;
    const phone = guest.whatsapp.replace(/\D/g, "");
    // With "both", a guest who has only one kind of contact still gets that one.
    const mode: SendMode = requested === "both" ? (phone && guest.email ? "both" : phone ? "whatsapp" : "email") : requested;
    const wantsWhatsapp = mode !== "email";
    const wantsEmail = mode !== "whatsapp";
    if (wantsWhatsapp && !phone) return void toast.error(`${guest.name} has no WhatsApp number. Edit the guest to add one.`);
    if (wantsEmail && !guest.email) return void toast.error(`${guest.name} has no email address.`);
    if (needsCustomQr(settings, guest)) return void toast.error(`No QR code uploaded for ${guest.name}. Upload one in Design, or switch to generated codes.`);
    setSelectedId(guest.id);
    const message = buildMessage(settings, guest, origin);
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    // Open windows straight away: browsers block pop-ups opened after waiting.
    const whatsappWindow = wantsWhatsapp ? window.open(whatsappUrl, "_blank") : null;
    if (wantsEmail) window.open(emailComposeUrl(guest.email, message), "_blank");
    setBusy(true);
    inviteBlob(guest)
      .then(async (blob) => {
        downloadBlob(blob, inviteFilename(guest));
        if (wantsWhatsapp && !whatsappWindow) window.location.href = whatsappUrl;
        toast.success(`Invite ready for ${guest.name}`, { description: "Attach the downloaded flyer to the message, then tap Send." });
        await markSent(guest);
      })
      .catch(fail)
      .finally(() => setBusy(false));
  }

  async function downloadInvite(guest: Guest) {
    if (settings && needsCustomQr(settings, guest)) return void toast.error(`No QR code uploaded for ${guest.name}.`);
    try {
      downloadBlob(await inviteBlob(guest), inviteFilename(guest));
    } catch (error) {
      fail(error);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      window.prompt(`Copy the ${label.toLowerCase()}:`, text);
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

  function downloadTemplate() {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Name", "WhatsApp Number", "Email", "Category"],
      ["Amara Okafor", "0803 555 0147", "amara@example.com", "VIP"],
      ["David Mensah", "+233 24 555 0188", "", "Guest"],
    ]);
    sheet["!cols"] = [{ wch: 24 }, { wch: 20 }, { wch: 26 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Guests");
    XLSX.writeFile(workbook, "guest-list-template.xlsx");
  }

  // ---------------------------------------------------------------- render
  const hiddenInputs = (
    <>
      <input ref={guestFileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleGuestFile} aria-label="Guest list file" />
      <input ref={flyerInput} type="file" accept="image/*" className="hidden" onChange={handleFlyer} aria-label="Flyer image" />
      <input ref={qrInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={handleQrFiles} aria-label="QR code images" />
    </>
  );
  const toaster = <Toaster position="top-center" richColors closeButton toastOptions={{ className: "rounded-2xl font-sans" }} />;

  if (events === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas text-ink-3">
        {loadError ? <p className="max-w-sm text-center text-danger">{loadError}</p> : <Loader2 className="animate-spin" />}
      </main>
    );
  }

  if (!event || !settings) {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas p-5">
        {toaster}
        <section className="w-full max-w-md text-center">
          <div className="flex justify-center"><Logo /></div>
          <div className="mt-10 rounded-3xl border border-line bg-surface p-7 shadow-[var(--shadow-card)]">
            <h1 className="text-2xl font-bold tracking-tight">Create your first event</h1>
            <p className="mt-2 text-ink-2">Give it a name. You’ll add the flyer and guests next.</p>
            <FirstEventForm onCreate={createEvent} />
          </div>
          <button onClick={signOut} className="mt-6 text-sm text-ink-3 underline underline-offset-4">Sign out</button>
        </section>
      </main>
    );
  }

  const state: StudioState = {
    origin,
    events,
    event,
    settings,
    guests,
    counts,
    selected,
    flyerUrl,
    previewQr,
    busy,
    tab,
    setTab,
    selectGuest: setSelectedId,
    switchEvent: (id) => {
      setEventId(id);
      setTabState("guests");
    },
    updateSettings,
    actions: {
      pickFlyer: () => flyerInput.current?.click(),
      removeFlyer,
      pickGuestFile: () => guestFileInput.current?.click(),
      pickQrFiles: () => qrInput.current?.click(),
      addGuest,
      editGuest: setEditing,
      deleteGuest,
      clearGuests,
      sendInvite,
      downloadInvite,
      copyMessage: (guest) => copy(buildMessage(settings, guest, origin), "Message"),
      openTicket: (guest) => window.open(ticketUrl(origin, guest), "_blank"),
      copy,
      exportGuests,
      downloadTemplate,
      renameEvent,
      newEvent: () => setNewEventOpen(true),
      deleteEvent,
      newPin,
      signOut,
      openAddGuests: (mode = "single") => {
        setAddMode(mode);
        setAddOpen(true);
      },
    },
  };

  const panel =
    tab === "guests" ? <GuestsPanel /> : tab === "design" ? <DesignPanel /> : tab === "message" ? <MessagePanel /> : tab === "checkin" ? <CheckinPanel /> : <div className="mx-auto max-w-md"><PreviewPanel showHeading={false} /></div>;
  const showSidePreview = tab !== "checkin" && tab !== "preview";

  return (
    <StudioContext.Provider value={state}>
      {toaster}
      {hiddenInputs}
      <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0">
          <MobileTopBar />
          <main className="mx-auto max-w-[1320px] px-4 pb-36 pt-4 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
            <PageHeader />
            <div className={showSidePreview ? "xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start xl:gap-8" : ""}>
              <div className="min-w-0">{panel}</div>
              {showSidePreview && (
                <aside className="hidden xl:sticky xl:top-10 xl:block">
                  <PreviewPanel />
                </aside>
              )}
            </div>
          </main>
        </div>
      </div>
      <MobileAddButton />
      <BottomNav />
      <AddGuestsDialog open={addOpen} mode={addMode} onOpenChange={setAddOpen} onModeChange={setAddMode} />
      <EditGuestDialog guest={editing} onClose={() => setEditing(null)} onSave={saveGuest} />
      <NewEventDialog open={newEventOpen} onOpenChange={setNewEventOpen} onCreate={createEvent} />
    </StudioContext.Provider>
  );
}

function FirstEventForm({ onCreate }: { onCreate: (name: string) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="mt-6 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        await onCreate(name.trim());
        setSaving(false);
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Annual Gala Night"
        aria-label="Event name"
        className="h-13 w-full rounded-2xl border border-line bg-surface px-4 text-center text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
      />
      <button disabled={saving || !name.trim()} className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white transition hover:brightness-110 disabled:opacity-40">
        {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Create event
      </button>
    </form>
  );
}
