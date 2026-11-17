import { searchGuests } from "@/lib/server/db";
import { requireCheckInEvent } from "@/lib/server/checkin";
import { handle, json } from "@/lib/server/http";

export const GET = handle(async (request) => {
  const event = await requireCheckInEvent(request);
  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 80);
  if (query.trim().length < 2) return json({ guests: [] });
  const guests = await searchGuests(event.id, query);
  return json({
    guests: guests.map(({ id, name, category, ticketCode, rsvp, checkedInAt }) => ({ id, name, category, ticketCode, rsvp, checkedInAt })),
  });
});
