import { checkInEventId } from "./auth";
import { getEvent, getGuest, type GuestRow, toPublicGuest } from "./db";
import { HttpError, assertSameOrigin } from "./http";

/** Resolves which event this check-in request is for, or rejects it. */
export async function requireCheckInEvent(request: Request) {
  assertSameOrigin(request);
  const requested = new URL(request.url).searchParams.get("event");
  const eventId = await checkInEventId(request, requested);
  if (!eventId) throw new HttpError(401, "Enter the event PIN to use the scanner.");
  const event = await getEvent(eventId);
  if (!event) throw new HttpError(401, "This event no longer exists. Enter a new PIN.");
  return event;
}

export function describeGuest(guest: GuestRow) {
  const { id, name, category, ticketCode, rsvp, checkedInAt } = toPublicGuest(guest);
  return { id, name, category, ticketCode, rsvp, checkedInAt };
}

export async function guestInEvent(guestId: string, eventId: string) {
  const guest = await getGuest(guestId);
  return guest && guest.event_id === eventId ? guest : null;
}
