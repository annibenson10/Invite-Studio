import { adminLogin } from "@/lib/server/auth";
import { assertSameOrigin, handle, json, readJson } from "@/lib/server/http";

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const { password } = await readJson<{ password?: unknown }>(request);
  const result = await adminLogin(request, typeof password === "string" ? password : "");
  if (!result.ok) return json({ error: result.error }, { status: result.status });
  return json({ ok: true }, { headers: { "set-cookie": result.cookie } });
});
