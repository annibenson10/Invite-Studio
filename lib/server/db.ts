import { env } from "cloudflare:workers";

/**
 * Data layer for Invite Studio, backed by a Cloudflare D1 (SQLite) database
 * bound as `DB`. Tables are created on first use, so a fresh database needs
 * no separate migration step.
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    settings TEXT NOT NULL DEFAULT '{}',
    checkin_pin TEXT NOT NULL UNIQUE,
    flyer_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS flyers (
    event_id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    data BLOB NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    ticket_code TEXT NOT NULL,
    name TEXT NOT NULL,
    whatsapp TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Guest',
    custom_qr_value TEXT,
    custom_qr_image TEXT,
    sent_at TEXT,
    rsvp TEXT,
    rsvp_at TEXT,
    checked_in_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, ticket_code)
  )`,
  `CREATE INDEX IF NOT EXISTS guests_by_event ON guests (event_id)`,
  `CREATE INDEX IF NOT EXISTS guests_by_custom_qr ON guests (event_id, custom_qr_value)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    window_start INTEGER NOT NULL
  )`,
];

let schemaReady: Promise<void> | null = null;

export function getD1(): D1Database {
  const db = (env as { DB?: D1Database }).DB;
  if (!db) {
    throw new Error("The database binding `DB` is missing. See README.md → Database.");
  }
  return db;
}

export async function db(): Promise<D1Database> {
  const database = getD1();
  if (!schemaReady) {
    schemaReady = database
      .batch(SCHEMA.map((statement) => database.prepare(statement)))
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaReady = null;
        throw error;
      });
  }
  await schemaReady;
  return database;
}

export function serverEnv(name: string): string | undefined {
  const value = (env as unknown as Record<string, unknown>)[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// ---------------------------------------------------------------------------
// Random identifiers

const ALPHANUMERIC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
// No 0/O, 1/I/L: ticket codes are read aloud and typed by door staff.
const TICKET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomString(length: number, alphabet: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
  let out = "";
  for (const byte of bytes) {
    // Rejection sampling keeps the distribution uniform.
    if (byte < 256 - (256 % alphabet.length)) out += alphabet[byte % alphabet.length];
    if (out.length === length) return out;
  }
  return out + randomString(length - out.length, alphabet);
}

export const newId = () => randomString(16, ALPHANUMERIC);
export const newToken = () => randomString(22, ALPHANUMERIC);
export const newTicketCode = () => {
  const raw = randomString(6, TICKET_ALPHABET);
  return `${raw.slice(0, 3)}-${raw.slice(3)}`;
};
export const newPin = () => {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(100000 + (bytes[0] % 900000));
};

// ---------------------------------------------------------------------------
// Row shapes

export type EventRow = {
  id: string;
  name: string;
  settings: string;
  checkin_pin: string;
  flyer_version: number;
  created_at: string;
};

export type GuestRow = {
  id: string;
  event_id: string;
  token: string;
  ticket_code: string;
  name: string;
  whatsapp: string;
  email: string;
  category: string;
  custom_qr_value: string | null;
  custom_qr_image: string | null;
  sent_at: string | null;
  rsvp: "yes" | "no" | null;
  rsvp_at: string | null;
  checked_in_at: string | null;
  created_at: string;
};

export type PublicEvent = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  checkinPin: string;
  flyerVersion: number;
  createdAt: string;
};

export type PublicGuest = {
  id: string;
  token: string;
  ticketCode: string;
  name: string;
  whatsapp: string;
  email: string;
  category: string;
  customQrValue: string | null;
  hasCustomQrImage: boolean;
  sentAt: string | null;
  rsvp: "yes" | "no" | null;
  rsvpAt: string | null;
  checkedInAt: string | null;
  createdAt: string;
};

export function toPublicEvent(row: EventRow): PublicEvent {
  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(row.settings) as Record<string, unknown>;
  } catch {
    settings = {};
  }
  return {
    id: row.id,
    name: row.name,
    settings,
    checkinPin: row.checkin_pin,
    flyerVersion: row.flyer_version,
    createdAt: row.created_at,
  };
}

export function toPublicGuest(row: GuestRow): PublicGuest {
  return {
    id: row.id,
    token: row.token,
    ticketCode: row.ticket_code,
    name: row.name,
    whatsapp: row.whatsapp,
    email: row.email,
    category: row.category,
    customQrValue: row.custom_qr_value,
    hasCustomQrImage: Boolean(row.custom_qr_image),
    sentAt: row.sent_at,
    rsvp: row.rsvp,
    rsvpAt: row.rsvp_at,
    checkedInAt: row.checked_in_at,
    createdAt: row.created_at,
  };
}

const GUEST_COLUMNS = `id, event_id, token, ticket_code, name, whatsapp, email, category,
  custom_qr_value, CASE WHEN custom_qr_image IS NULL THEN NULL ELSE '1' END AS custom_qr_image,
  sent_at, rsvp, rsvp_at, checked_in_at, created_at`;

// ---------------------------------------------------------------------------
// Events

export async function listEvents() {
  const database = await db();
  const { results } = await database
    .prepare("SELECT * FROM events ORDER BY created_at DESC")
    .all<EventRow>();
  return results.map(toPublicEvent);
}

export async function getEvent(id: string) {
  const database = await db();
  return database.prepare("SELECT * FROM events WHERE id = ?").bind(id).first<EventRow>();
}

export async function createEvent(name: string) {
  const database = await db();
  const id = newId();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await database
        .prepare("INSERT INTO events (id, name, checkin_pin) VALUES (?, ?, ?)")
        .bind(id, name, newPin())
        .run();
      return (await getEvent(id))!;
    } catch (error) {
      if (!String(error).includes("UNIQUE")) throw error;
    }
  }
  throw new Error("Could not create the event. Please try again.");
}

export async function updateEvent(id: string, changes: { name?: string; settings?: Record<string, unknown> }) {
  const database = await db();
  if (changes.name !== undefined) {
    await database.prepare("UPDATE events SET name = ? WHERE id = ?").bind(changes.name, id).run();
  }
  if (changes.settings !== undefined) {
    await database
      .prepare("UPDATE events SET settings = ? WHERE id = ?")
      .bind(JSON.stringify(changes.settings), id)
      .run();
  }
  return getEvent(id);
}

export async function regeneratePin(id: string) {
  const database = await db();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await database.prepare("UPDATE events SET checkin_pin = ? WHERE id = ?").bind(newPin(), id).run();
      return getEvent(id);
    } catch (error) {
      if (!String(error).includes("UNIQUE")) throw error;
    }
  }
  throw new Error("Could not create a new PIN. Please try again.");
}

export async function deleteEvent(id: string) {
  const database = await db();
  await database.batch([
    database.prepare("DELETE FROM guests WHERE event_id = ?").bind(id),
    database.prepare("DELETE FROM flyers WHERE event_id = ?").bind(id),
    database.prepare("DELETE FROM events WHERE id = ?").bind(id),
  ]);
}

export async function getEventByPin(pin: string) {
  const database = await db();
  return database.prepare("SELECT * FROM events WHERE checkin_pin = ?").bind(pin).first<EventRow>();
}

export async function saveFlyer(eventId: string, mime: string, data: ArrayBuffer) {
  const database = await db();
  await database.batch([
    database
      .prepare(
        "INSERT INTO flyers (event_id, mime, data) VALUES (?, ?, ?) ON CONFLICT(event_id) DO UPDATE SET mime = excluded.mime, data = excluded.data",
      )
      .bind(eventId, mime, data),
    database.prepare("UPDATE events SET flyer_version = flyer_version + 1 WHERE id = ?").bind(eventId),
  ]);
  return getEvent(eventId);
}

export async function removeFlyer(eventId: string) {
  const database = await db();
  await database.batch([
    database.prepare("DELETE FROM flyers WHERE event_id = ?").bind(eventId),
    database.prepare("UPDATE events SET flyer_version = 0 WHERE id = ?").bind(eventId),
  ]);
  return getEvent(eventId);
}

export async function getFlyer(eventId: string) {
  const database = await db();
  return database
    .prepare("SELECT mime, data FROM flyers WHERE event_id = ?")
    .bind(eventId)
    .first<{ mime: string; data: ArrayBuffer | number[] }>();
}

// ---------------------------------------------------------------------------
// Guests

export async function listGuests(eventId: string) {
  const database = await db();
  const { results } = await database
    .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE event_id = ? ORDER BY created_at, rowid`)
    .bind(eventId)
    .all<GuestRow>();
  return results.map(toPublicGuest);
}

export async function getGuest(id: string) {
  const database = await db();
  return database.prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE id = ?`).bind(id).first<GuestRow>();
}

export async function getGuestByToken(token: string) {
  const database = await db();
  return database.prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE token = ?`).bind(token).first<GuestRow>();
}

export async function getCustomQrImage(id: string) {
  const database = await db();
  const row = await database
    .prepare("SELECT custom_qr_image FROM guests WHERE id = ?")
    .bind(id)
    .first<{ custom_qr_image: string | null }>();
  return row?.custom_qr_image ?? null;
}

export type NewGuest = { name: string; whatsapp: string; email: string; category: string };

export async function addGuests(eventId: string, guests: NewGuest[]) {
  const database = await db();
  const { results } = await database
    .prepare("SELECT ticket_code FROM guests WHERE event_id = ?")
    .bind(eventId)
    .all<{ ticket_code: string }>();
  const usedCodes = new Set(results.map((row) => row.ticket_code));
  const ids: string[] = [];
  const statements = guests.map((guest) => {
    let code = newTicketCode();
    while (usedCodes.has(code)) code = newTicketCode();
    usedCodes.add(code);
    const id = newId();
    ids.push(id);
    return database
      .prepare(
        "INSERT INTO guests (id, event_id, token, ticket_code, name, whatsapp, email, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(id, eventId, newToken(), code, guest.name, guest.whatsapp, guest.email, guest.category);
  });
  // D1 limits how many statements one batch may hold, so insert in chunks.
  for (let index = 0; index < statements.length; index += 50) {
    await database.batch(statements.slice(index, index + 50));
  }
  return ids;
}

export type GuestChanges = Partial<{
  name: string;
  whatsapp: string;
  email: string;
  category: string;
  customQrValue: string | null;
  customQrImage: string | null;
  sent: boolean;
  rsvp: "yes" | "no" | null;
  checkedIn: boolean;
}>;

export async function updateGuest(id: string, changes: GuestChanges) {
  const database = await db();
  const sets: string[] = [];
  const values: unknown[] = [];
  const plain: [keyof GuestChanges, string][] = [
    ["name", "name"],
    ["whatsapp", "whatsapp"],
    ["email", "email"],
    ["category", "category"],
    ["customQrValue", "custom_qr_value"],
    ["customQrImage", "custom_qr_image"],
  ];
  for (const [key, column] of plain) {
    if (changes[key] !== undefined) {
      sets.push(`${column} = ?`);
      values.push(changes[key]);
    }
  }
  if (changes.sent !== undefined) {
    sets.push(changes.sent ? "sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP)" : "sent_at = NULL");
  }
  if (changes.rsvp !== undefined) {
    sets.push("rsvp = ?", "rsvp_at = CASE WHEN ? IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END");
    values.push(changes.rsvp, changes.rsvp);
  }
  if (changes.checkedIn !== undefined) {
    sets.push(changes.checkedIn ? "checked_in_at = COALESCE(checked_in_at, CURRENT_TIMESTAMP)" : "checked_in_at = NULL");
  }
  if (sets.length) {
    await database
      .prepare(`UPDATE guests SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values, id)
      .run();
  }
  return getGuest(id);
}

export async function deleteGuest(id: string) {
  const database = await db();
  await database.prepare("DELETE FROM guests WHERE id = ?").bind(id).run();
}

export async function deleteAllGuests(eventId: string) {
  const database = await db();
  await database.prepare("DELETE FROM guests WHERE event_id = ?").bind(eventId).run();
}

/** Records an RSVP only if the guest has not answered yet. Returns the stored answer. */
export async function recordRsvp(token: string, response: "yes" | "no") {
  const database = await db();
  await database
    .prepare("UPDATE guests SET rsvp = ?, rsvp_at = CURRENT_TIMESTAMP WHERE token = ? AND rsvp IS NULL")
    .bind(response, token)
    .run();
  return getGuestByToken(token);
}

// ---------------------------------------------------------------------------
// Check-in

export async function findGuestForScan(eventId: string, code: string) {
  const database = await db();
  const trimmed = code.trim();
  // Our own QR codes hold a link ending in /t/<token>.
  const tokenMatch = trimmed.match(/\/t\/([A-Za-z0-9]{10,64})(?:[/?#]|$)/);
  if (tokenMatch) {
    return database
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE event_id = ? AND token = ?`)
      .bind(eventId, tokenMatch[1])
      .first<GuestRow>();
  }
  // Uploaded QR codes hold whatever the organiser's own system put in them.
  const custom = await database
    .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE event_id = ? AND custom_qr_value = ?`)
    .bind(eventId, trimmed)
    .first<GuestRow>();
  if (custom) return custom;
  // Door staff may type the printed ticket code instead.
  const ticket = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (ticket.length === 6) {
    return database
      .prepare(`SELECT ${GUEST_COLUMNS} FROM guests WHERE event_id = ? AND ticket_code = ?`)
      .bind(eventId, `${ticket.slice(0, 3)}-${ticket.slice(3)}`)
      .first<GuestRow>();
  }
  return null;
}

export async function searchGuests(eventId: string, query: string) {
  const database = await db();
  const like = `%${query.trim().replace(/[%_]/g, "")}%`;
  const { results } = await database
    .prepare(
      `SELECT ${GUEST_COLUMNS} FROM guests WHERE event_id = ? AND (name LIKE ? OR ticket_code LIKE ? OR whatsapp LIKE ? OR email LIKE ?) ORDER BY name LIMIT 20`,
    )
    .bind(eventId, like, like, like, like)
    .all<GuestRow>();
  return results.map(toPublicGuest);
}

/** Marks the guest as arrived. Returns whether this scan was the first one. */
export async function checkIn(guestId: string) {
  const database = await db();
  const result = await database
    .prepare("UPDATE guests SET checked_in_at = CURRENT_TIMESTAMP WHERE id = ? AND checked_in_at IS NULL")
    .bind(guestId)
    .run();
  const guest = await getGuest(guestId);
  return { first: (result.meta.changes ?? 0) > 0, guest };
}

export async function checkInStats(eventId: string) {
  const database = await db();
  const row = await database
    .prepare(
      `SELECT COUNT(*) AS total,
        SUM(CASE WHEN checked_in_at IS NOT NULL THEN 1 ELSE 0 END) AS checked_in,
        SUM(CASE WHEN rsvp = 'yes' THEN 1 ELSE 0 END) AS attending
       FROM guests WHERE event_id = ?`,
    )
    .bind(eventId)
    .first<{ total: number; checked_in: number | null; attending: number | null }>();
  return { total: row?.total ?? 0, checkedIn: row?.checked_in ?? 0, attending: row?.attending ?? 0 };
}

// ---------------------------------------------------------------------------
// Login throttling (per IP), so passwords and PINs cannot be guessed quickly.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export async function isLockedOut(key: string) {
  const database = await db();
  const row = await database
    .prepare("SELECT count, window_start FROM login_attempts WHERE key = ?")
    .bind(key)
    .first<{ count: number; window_start: number }>();
  if (!row) return false;
  if (Date.now() - row.window_start > WINDOW_MS) return false;
  return row.count >= MAX_ATTEMPTS;
}

export async function recordFailedLogin(key: string) {
  const database = await db();
  const now = Date.now();
  await database
    .prepare(
      `INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN ? - window_start > ? THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN ? - window_start > ? THEN ? ELSE window_start END`,
    )
    .bind(key, now, now, WINDOW_MS, now, WINDOW_MS, now)
    .run();
}

export async function clearFailedLogins(key: string) {
  const database = await db();
  await database.prepare("DELETE FROM login_attempts WHERE key = ?").bind(key).run();
}
