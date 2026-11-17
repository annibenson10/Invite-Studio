import { checkIn, checkInStats, findGuestForScan } from "@/lib/server/db";
import { describeGuest, requireCheckInEvent } from "@/lib/server/checkin";
import { HttpError, handle, json, readJson } from "@/lib/server/http";

export const POST = handle(async (request) => {
  const event = await requireCheckInEvent(request);
  const { code } = await readJson<{ code?: unknown }>(request);
  if (typeof code !== "string" || !code.trim() || code.length > 2000) throw new HttpError(400, "No code was scanned.");
  const guest = await findGuestForScan(event.id, code);
  if (!guest) return json({ result: "not_found", stats: await checkInStats(event.id) });
  const { first, guest: updated } = await checkIn(guest.id);
  return json({
    result: first ? "checked_in" : "already_checked_in",
    guest: describeGuest(first ? updated! : guest),
    stats: await checkInStats(event.id),
  });
});
