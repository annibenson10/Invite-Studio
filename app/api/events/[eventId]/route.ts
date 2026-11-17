import { deleteEvent, getEvent, toPublicEvent, updateEvent } from "@/lib/server/db";
import { HttpError, handle, json, readJson, requireAdmin, text } from "@/lib/server/http";

type Context = { params: Promise<{ eventId: string }> };

async function loadEvent(context: Context) {
  const { eventId } = await context.params;
  const event = await getEvent(eventId);
  if (!event) throw new HttpError(404, "Event not found.");
  return event;
}

export const GET = handle(async (request, context: Context) => {
  await requireAdmin(request);
  return json({ event: toPublicEvent(await loadEvent(context)) });
});

export const PATCH = handle(async (request, context: Context) => {
  await requireAdmin(request);
  const event = await loadEvent(context);
  const body = await readJson<{ name?: unknown; settings?: unknown }>(request);
  const name = text(body.name, "Event name", { max: 120 });
  if (name === "") throw new HttpError(400, "Event name cannot be empty.");
  let settings: Record<string, unknown> | undefined;
  if (body.settings !== undefined) {
    if (typeof body.settings !== "object" || body.settings === null || Array.isArray(body.settings)) {
      throw new HttpError(400, "Settings must be an object.");
    }
    if (JSON.stringify(body.settings).length > 20_000) throw new HttpError(400, "Settings are too large.");
    settings = body.settings as Record<string, unknown>;
  }
  const updated = await updateEvent(event.id, { name, settings });
  return json({ event: toPublicEvent(updated!) });
});

export const DELETE = handle(async (request, context: Context) => {
  await requireAdmin(request);
  const event = await loadEvent(context);
  await deleteEvent(event.id);
  return json({ ok: true });
});
