import { createEvent, listEvents, toPublicEvent } from "@/lib/server/db";
import { handle, json, readJson, requireAdmin, text } from "@/lib/server/http";

export const GET = handle(async (request) => {
  await requireAdmin(request);
  return json({ events: await listEvents() });
});

export const POST = handle(async (request) => {
  await requireAdmin(request);
  const body = await readJson<{ name?: unknown }>(request);
  const name = text(body.name, "Event name", { required: true, max: 120 })!;
  return json({ event: toPublicEvent(await createEvent(name)) }, { status: 201 });
});
