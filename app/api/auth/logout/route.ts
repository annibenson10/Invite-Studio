import { ADMIN_COOKIE, clearCookieHeader } from "@/lib/server/auth";
import { assertSameOrigin, handle, json } from "@/lib/server/http";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  return json({ ok: true }, { headers: { "set-cookie": clearCookieHeader(request, ADMIN_COOKIE) } });
});
