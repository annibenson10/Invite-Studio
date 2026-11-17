import { clearFailedLogins, isLockedOut, recordFailedLogin, serverEnv } from "./db";

/**
 * Two kinds of signed-in visitor:
 *  - the organiser, who knows ADMIN_PASSWORD and can do everything;
 *  - door staff, who know one event's check-in PIN and can only check guests in.
 * Sessions are stateless cookies signed with HMAC-SHA256.
 */

export const ADMIN_COOKIE = "invite_admin";
export const STAFF_COOKIE = "invite_staff";
const ADMIN_TTL_SECONDS = 60 * 60 * 24 * 14;
const STAFF_TTL_SECONDS = 60 * 60 * 24;

type Session = { role: "admin"; exp: number } | { role: "staff"; eventId: string; exp: number };

const encoder = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export function adminPasswordConfigured() {
  return Boolean(serverEnv("ADMIN_PASSWORD"));
}

function signingSecret() {
  const secret = serverEnv("SESSION_SECRET") ?? serverEnv("ADMIN_PASSWORD");
  if (!secret) throw new Error("ADMIN_PASSWORD is not set. See README.md → Configuration.");
  return secret;
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", encoder.encode(signingSecret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

async function sign(session: Session) {
  const payload = base64url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload));
  return `${payload}.${base64url(signature)}`;
}

async function verify(value: string | undefined | null): Promise<Session | null> {
  if (!value || !adminPasswordConfigured()) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(), fromBase64url(signature), encoder.encode(payload));
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as Session;
    if (typeof session.exp !== "number" || session.exp < Date.now() / 1000) return null;
    return session;
  } catch {
    return null;
  }
}

/** Compares two strings without leaking how many leading characters match. */
async function safeEqual(a: string, b: string) {
  const key = await hmacKey();
  const [x, y] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const left = new Uint8Array(x);
  const right = new Uint8Array(y);
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left[index] ^ right[index];
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Cookies

export function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function cookieHeader(request: Request, name: string, value: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearCookieHeader(request: Request, name: string) {
  return cookieHeader(request, name, "", 0);
}

function clientKey(request: Request, scope: string) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  return `${scope}:${ip.trim()}`;
}

// ---------------------------------------------------------------------------
// Admin

export async function adminLogin(request: Request, password: string) {
  const key = clientKey(request, "admin");
  if (!adminPasswordConfigured()) return { ok: false as const, status: 503, error: "ADMIN_PASSWORD has not been set on the server." };
  if (await isLockedOut(key)) return { ok: false as const, status: 429, error: "Too many attempts. Try again in 15 minutes." };
  if (!(await safeEqual(password, serverEnv("ADMIN_PASSWORD")!))) {
    await recordFailedLogin(key);
    return { ok: false as const, status: 401, error: "That password is not correct." };
  }
  await clearFailedLogins(key);
  const token = await sign({ role: "admin", exp: Math.floor(Date.now() / 1000) + ADMIN_TTL_SECONDS });
  return { ok: true as const, cookie: cookieHeader(request, ADMIN_COOKIE, token, ADMIN_TTL_SECONDS) };
}

export async function isAdminCookie(value: string | undefined | null) {
  const session = await verify(value);
  return session?.role === "admin";
}

export async function isAdmin(request: Request) {
  return isAdminCookie(readCookie(request, ADMIN_COOKIE));
}

// ---------------------------------------------------------------------------
// Door staff

export async function staffSessionToken(eventId: string) {
  return sign({ role: "staff", eventId, exp: Math.floor(Date.now() / 1000) + STAFF_TTL_SECONDS });
}

export function staffCookieHeader(request: Request, token: string) {
  return cookieHeader(request, STAFF_COOKIE, token, STAFF_TTL_SECONDS);
}

export async function staffEventFromCookie(value: string | undefined | null) {
  const session = await verify(value);
  return session?.role === "staff" ? session.eventId : null;
}

/** Event the caller may check guests into: the staff session's event, or any event for the organiser. */
export async function checkInEventId(request: Request, requestedEventId?: string | null) {
  if (await isAdmin(request)) return requestedEventId ?? (await staffEventFromCookie(readCookie(request, STAFF_COOKIE)));
  return staffEventFromCookie(readCookie(request, STAFF_COOKIE));
}

export { clientKey };
