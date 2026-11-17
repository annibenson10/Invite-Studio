/** Small fetch wrapper for the app's own JSON API. Throws with the server's error message. */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    const error = new Error(data.error ?? `Request failed (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data;
}

/** Database timestamps are UTC "YYYY-MM-DD HH:MM:SS". */
export function parseDbTime(value: string | null | undefined) {
  return value ? new Date(`${value.replace(" ", "T")}Z`) : null;
}

export function formatTime(value: string | null | undefined) {
  const date = parseDbTime(value);
  return date ? date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}
