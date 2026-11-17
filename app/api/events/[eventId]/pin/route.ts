import { getEvent, regeneratePin, toPublicEvent } from "@/lib/server/db";
import { HttpError, handle, json, requireAdmin } from "@/lib/server/http";

export const POST = handle(async (request, context: { params: Promise<{ eventId: string }> }) => {
  await requireAdmin(request);
  const { eventId } = await context.params;
  if (!(await getEvent(eventId))) throw new HttpError(404, "Event not found.");
  return json({ event: toPublicEvent((await regeneratePin(eventId))!) });
});
