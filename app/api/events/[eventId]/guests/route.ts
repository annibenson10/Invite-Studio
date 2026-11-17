import { addGuests, deleteAllGuests, getEvent, listGuests } from "@/lib/server/db";
import { parseNewGuest } from "@/lib/server/guest-input";
import { HttpError, handle, json, readJson, requireAdmin } from "@/lib/server/http";

type Context = { params: Promise<{ eventId: string }> };
const MAX_GUESTS_PER_REQUEST = 2000;

async function eventIdFrom(context: Context) {
  const { eventId } = await context.params;
  if (!(await getEvent(eventId))) throw new HttpError(404, "Event not found.");
  return eventId;
}

export const GET = handle(async (request, context: Context) => {
  await requireAdmin(request);
  return json({ guests: await listGuests(await eventIdFrom(context)) });
});

/** Adds one or more guests. Guests whose phone number or email is already on the list are skipped. */
export const POST = handle(async (request, context: Context) => {
  await requireAdmin(request);
  const eventId = await eventIdFrom(context);
  const body = await readJson<{ guests?: unknown }>(request);
  const input: unknown[] = Array.isArray(body.guests) ? body.guests : [];
  if (input.length === 0) throw new HttpError(400, "Send at least one guest.");
  if (input.length > MAX_GUESTS_PER_REQUEST) throw new HttpError(400, `Import at most ${MAX_GUESTS_PER_REQUEST} guests at a time.`);
  const parsed = input.map((guest, index) => parseNewGuest(guest, input.length > 1 ? index : undefined));

  const existing = await listGuests(eventId);
  const seenPhones = new Set(existing.map((guest) => guest.whatsapp).filter(Boolean));
  const seenEmails = new Set(existing.map((guest) => guest.email).filter(Boolean));
  const toAdd = [];
  const skipped: string[] = [];
  for (const guest of parsed) {
    if ((guest.whatsapp && seenPhones.has(guest.whatsapp)) || (guest.email && seenEmails.has(guest.email))) {
      skipped.push(guest.name);
      continue;
    }
    if (guest.whatsapp) seenPhones.add(guest.whatsapp);
    if (guest.email) seenEmails.add(guest.email);
    toAdd.push(guest);
  }
  if (parsed.length === 1 && skipped.length === 1) {
    throw new HttpError(409, "A guest with this WhatsApp number or email is already on the list.");
  }
  const ids = toAdd.length ? await addGuests(eventId, toAdd) : [];
  return json({ added: ids, skipped, guests: await listGuests(eventId) }, { status: 201 });
});

export const DELETE = handle(async (request, context: Context) => {
  await requireAdmin(request);
  await deleteAllGuests(await eventIdFrom(context));
  return json({ ok: true });
});
