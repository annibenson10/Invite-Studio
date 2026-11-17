import { isAdmin } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

/**
 * Rejects state-changing requests that come from another website. Browsers
 * always send Origin on cross-site POST/PATCH/DELETE, so a mismatch means the
 * request did not come from this app's own pages.
 */
export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (new URL(origin).host !== host) throw new HttpError(403, "Request blocked: it did not come from this site.");
}

export async function requireAdmin(request: Request) {
  assertSameOrigin(request);
  if (!(await isAdmin(request))) throw new HttpError(401, "Please sign in again.");
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "The request body was not valid JSON.");
  }
}

/** Wraps a route handler so thrown errors become JSON responses. */
export function handle<Args extends unknown[]>(fn: (request: Request, ...args: Args) => Promise<Response>) {
  return async (request: Request, ...args: Args) => {
    try {
      return await fn(request, ...args);
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
      console.error(error);
      return json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
    }
  };
}

const MAX_TEXT = 500;

export function text(value: unknown, field: string, { required = false, max = MAX_TEXT } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${field} is required.`);
    return undefined;
  }
  if (typeof value !== "string") throw new HttpError(400, `${field} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, `${field} is required.`);
  if (trimmed.length > max) throw new HttpError(400, `${field} is too long.`);
  return trimmed;
}
