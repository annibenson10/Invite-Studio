import { getEvent, getGuestByToken } from "./db";

/** Loads what a guest is allowed to see about their own invitation. */
export async function loadInvitation(token: string) {
  if (!/^[A-Za-z0-9]{10,64}$/.test(token)) return null;
  const guest = await getGuestByToken(token);
  if (!guest) return null;
  const event = await getEvent(guest.event_id);
  if (!event) return null;
  return {
    guestName: guest.name,
    ticketCode: guest.ticket_code,
    category: guest.category,
    rsvp: guest.rsvp,
    checkedInAt: guest.checked_in_at,
    eventName: event.name,
    flyerUrl: event.flyer_version > 0 ? `/api/events/${event.id}/flyer?v=${event.flyer_version}` : null,
  };
}
