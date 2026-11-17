import { getGuestByToken, recordRsvp } from "@/lib/server/db";
import { HttpError, assertSameOrigin, handle, json, readJson } from "@/lib/server/http";

/** Public: the guest's own RSVP. Only the first answer counts. */
export const POST = handle(async (request, context: { params: Promise<{ token: string }> }) => {
  assertSameOrigin(request);
  const { token } = await context.params;
  const { response } = await readJson<{ response?: unknown }>(request);
  if (response !== "yes" && response !== "no") throw new HttpError(400, "Choose yes or no.");
  const before = await getGuestByToken(token);
  if (!before) throw new HttpError(404, "This invitation link is not valid.");
  const after = await recordRsvp(token, response);
  return json({ response: after?.rsvp, alreadySubmitted: before.rsvp !== null });
});
