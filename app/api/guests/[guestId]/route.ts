import { deleteGuest, getGuest, listGuests, toPublicGuest, updateGuest } from "@/lib/server/db";
import { parseGuestChanges } from "@/lib/server/guest-input";
import { HttpError, handle, json, readJson, requireAdmin } from "@/lib/server/http";

type Context = { params: Promise<{ guestId: string }> };

async function loadGuest(context: Context) {
  const { guestId } = await context.params;
  const guest = await getGuest(guestId);
  if (!guest) throw new HttpError(404, "Guest not found.");
  return guest;
}

export const PATCH = handle(async (request, context: Context) => {
  await requireAdmin(request);
  const guest = await loadGuest(context);
  const changes = parseGuestChanges(await readJson(request));
  if (changes.whatsapp || changes.email) {
    const others = (await listGuests(guest.event_id)).filter((other) => other.id !== guest.id);
    if (changes.whatsapp && others.some((other) => other.whatsapp === changes.whatsapp)) {
      throw new HttpError(409, "Another guest already uses this WhatsApp number.");
    }
    if (changes.email && others.some((other) => other.email === changes.email)) {
      throw new HttpError(409, "Another guest already uses this email address.");
    }
  }
  const updated = await updateGuest(guest.id, changes);
  return json({ guest: toPublicGuest(updated!) });
});

export const DELETE = handle(async (request, context: Context) => {
  await requireAdmin(request);
  const guest = await loadGuest(context);
  await deleteGuest(guest.id);
  return json({ ok: true });
});
