import { getCustomQrImage } from "@/lib/server/db";
import { handle, requireAdmin } from "@/lib/server/http";

export const GET = handle(async (request, context: { params: Promise<{ guestId: string }> }) => {
  await requireAdmin(request);
  const { guestId } = await context.params;
  const image = await getCustomQrImage(guestId);
  const match = image?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!match) return new Response("Not found", { status: 404 });
  const bytes = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  return new Response(bytes, { headers: { "content-type": match[1], "cache-control": "private, no-cache" } });
});
