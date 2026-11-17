import { checkIn, checkInStats, updateGuest } from "@/lib/server/db";
import { describeGuest, guestInEvent, requireCheckInEvent } from "@/lib/server/checkin";
import { HttpError, handle, json } from "@/lib/server/http";

type Context = { params: Promise<{ guestId: string }> };

/** Check a guest in by tapping their name in the search results. */
export const POST = handle(async (request, context: Context) => {
  const event = await requireCheckInEvent(request);
  const { guestId } = await context.params;
  const guest = await guestInEvent(guestId, event.id);
  if (!guest) throw new HttpError(404, "Guest not found for this event.");
  const { first, guest: updated } = await checkIn(guest.id);
  return json({
    result: first ? "checked_in" : "already_checked_in",
    guest: describeGuest(first ? updated! : guest),
    stats: await checkInStats(event.id),
  });
});

/** Undo an accidental check-in. */
export const DELETE = handle(async (request, context: Context) => {
  const event = await requireCheckInEvent(request);
  const { guestId } = await context.params;
  const guest = await guestInEvent(guestId, event.id);
  if (!guest) throw new HttpError(404, "Guest not found for this event.");
  const updated = await updateGuest(guest.id, { checkedIn: false });
  return json({ guest: describeGuest(updated!), stats: await checkInStats(event.id) });
});
