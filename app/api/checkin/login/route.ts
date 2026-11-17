import { clientKey, staffCookieHeader, staffSessionToken } from "@/lib/server/auth";
import { clearFailedLogins, getEventByPin, isLockedOut, recordFailedLogin } from "@/lib/server/db";
import { assertSameOrigin, handle, json, readJson } from "@/lib/server/http";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const key = clientKey(request, "staff");
  if (await isLockedOut(key)) return json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const { pin } = await readJson<{ pin?: unknown }>(request);
  const cleaned = typeof pin === "string" ? pin.replace(/\D/g, "") : "";
  const event = cleaned.length === 6 ? await getEventByPin(cleaned) : null;
  if (!event) {
    await recordFailedLogin(key);
    return json({ error: "That PIN does not match any event." }, { status: 401 });
  }
  await clearFailedLogins(key);
  const token = await staffSessionToken(event.id);
  return json({ eventName: event.name }, { headers: { "set-cookie": staffCookieHeader(request, token) } });
});
