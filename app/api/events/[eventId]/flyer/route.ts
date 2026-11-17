import { getEvent, getFlyer, removeFlyer, saveFlyer, toPublicEvent } from "@/lib/server/db";
import { HttpError, handle, json, requireAdmin } from "@/lib/server/http";

type Context = { params: Promise<{ eventId: string }> };
const MAX_BYTES = 1_900_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

// Public: guests' ticket pages show the flyer.
export const GET = handle(async (_request, context: Context) => {
  const { eventId } = await context.params;
  const flyer = await getFlyer(eventId);
  if (!flyer) return new Response("Not found", { status: 404 });
  const bytes = flyer.data instanceof ArrayBuffer ? new Uint8Array(flyer.data) : Uint8Array.from(flyer.data);
  return new Response(bytes, {
    headers: {
      "content-type": flyer.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
});

export const PUT = handle(async (request, context: Context) => {
  await requireAdmin(request);
  const { eventId } = await context.params;
  if (!(await getEvent(eventId))) throw new HttpError(404, "Event not found.");
  const mime = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!ALLOWED.has(mime)) throw new HttpError(400, "The flyer must be a JPG, PNG or WebP image.");
  const data = await request.arrayBuffer();
  if (data.byteLength > MAX_BYTES) throw new HttpError(400, "The flyer is too large. Please use an image under 1.9 MB.");
  return json({ event: toPublicEvent((await saveFlyer(eventId, mime, data))!) });
});

export const DELETE = handle(async (request, context: Context) => {
  await requireAdmin(request);
  const { eventId } = await context.params;
  return json({ event: toPublicEvent((await removeFlyer(eventId))!) });
});
