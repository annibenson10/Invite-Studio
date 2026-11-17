import { checkInStats } from "@/lib/server/db";
import { requireCheckInEvent } from "@/lib/server/checkin";
import { handle, json } from "@/lib/server/http";

export const GET = handle(async (request) => {
  const event = await requireCheckInEvent(request);
  return json({ eventName: event.name, stats: await checkInStats(event.id) });
});
