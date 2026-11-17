import { EMAIL_PATTERN, GUEST_CATEGORIES, normalisePhone } from "../country-codes";
import { HttpError, text } from "./http";
import type { GuestChanges, NewGuest } from "./db";

/** Validates one guest sent from the dashboard. Phone numbers must already include a country code. */
export function parseNewGuest(input: unknown, index?: number): NewGuest {
  const where = index === undefined ? "" : ` (row ${index + 1})`;
  const value = (input ?? {}) as Record<string, unknown>;
  const name = text(value.name, `Guest name${where}`, { required: true, max: 120 })!;
  const whatsappRaw = text(value.whatsapp, `WhatsApp number${where}`, { max: 40 }) ?? "";
  const whatsapp = whatsappRaw ? normalisePhone(whatsappRaw.startsWith("+") ? whatsappRaw : `+${whatsappRaw}`, "") : "";
  if (whatsapp === null) throw new HttpError(400, `The WhatsApp number for ${name} is not valid${where}.`);
  const email = (text(value.email, `Email${where}`, { max: 200 }) ?? "").toLowerCase();
  if (email && !EMAIL_PATTERN.test(email)) throw new HttpError(400, `The email address for ${name} is not valid${where}.`);
  if (!whatsapp && !email) throw new HttpError(400, `${name} needs a WhatsApp number or an email address${where}.`);
  const category = text(value.category, `Category${where}`, { max: 40 }) || "Guest";
  return { name, whatsapp, email, category };
}

export function parseGuestChanges(input: unknown): GuestChanges {
  const value = (input ?? {}) as Record<string, unknown>;
  const changes: GuestChanges = {};
  if ("name" in value || "whatsapp" in value || "email" in value || "category" in value) {
    const guest = parseNewGuest({ name: value.name, whatsapp: value.whatsapp, email: value.email, category: value.category });
    Object.assign(changes, guest);
  }
  if ("customQrValue" in value) {
    changes.customQrValue = value.customQrValue === null ? null : text(value.customQrValue, "QR value", { max: 2000 }) ?? null;
  }
  if ("customQrImage" in value) {
    const image = value.customQrImage;
    if (image !== null && (typeof image !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(image) || image.length > 400_000)) {
      throw new HttpError(400, "The QR image must be a PNG, JPG or WebP under 300 KB.");
    }
    changes.customQrImage = image as string | null;
  }
  if ("sent" in value) changes.sent = Boolean(value.sent);
  if ("checkedIn" in value) changes.checkedIn = Boolean(value.checkedIn);
  if ("rsvp" in value) {
    if (value.rsvp !== null && value.rsvp !== "yes" && value.rsvp !== "no") throw new HttpError(400, "RSVP must be yes, no or empty.");
    changes.rsvp = value.rsvp as "yes" | "no" | null;
  }
  return changes;
}

export { GUEST_CATEGORIES };
