/**
 * Event settings, message building and invitation drawing, shared by the
 * organiser dashboard. Runs in the browser.
 */

export type Pattern = "none" | "dots" | "weave" | "diamonds";

export type InviteSettings = {
  flyerZoom: number;
  flyerX: number;
  flyerY: number;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  pattern: Pattern;
  qrMode: "automatic" | "custom";
  checkInMode: "qr" | "link";
  deliveryMode: "whatsapp" | "both";
  messageTemplate: string;
  emailSubject: string;
  emailProvider: "gmail" | "outlook" | "default";
  senderEmail: string;
  defaultCountryCode: string;
};

export const defaultSettings = (eventName: string): InviteSettings => ({
  flyerZoom: 1,
  flyerX: 50,
  flyerY: 50,
  watermarkEnabled: false,
  watermarkText: "",
  watermarkOpacity: 8,
  pattern: "none",
  qrMode: "automatic",
  checkInMode: "qr",
  deliveryMode: "whatsapp",
  messageTemplate: `Hello {name},\n\nYour personalised invitation to ${eventName} is ready.\n\nWe look forward to celebrating with you!`,
  emailSubject: `Your invitation to ${eventName}`,
  emailProvider: "gmail",
  senderEmail: "",
  defaultCountryCode: "+234",
});

export function mergeSettings(eventName: string, stored: Record<string, unknown>): InviteSettings {
  const defaults = defaultSettings(eventName);
  const merged = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof InviteSettings)[]) {
    if (typeof stored[key] === typeof defaults[key]) merged[key] = stored[key];
  }
  return merged as InviteSettings;
}

export type Guest = {
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

export type EventInfo = {
  id: string;
  name: string;
  settings: Record<string, unknown>;
  checkinPin: string;
  flyerVersion: number;
  createdAt: string;
};

export const ticketUrl = (origin: string, guest: Guest) => `${origin}/t/${guest.token}`;
export const rsvpUrl = (origin: string, guest: Guest, answer?: "yes" | "no") =>
  `${origin}/rsvp/${guest.token}${answer ? `?r=${answer}` : ""}`;

export function buildMessage(settings: InviteSettings, guest: Guest, origin: string) {
  const greeting = settings.messageTemplate.replaceAll("{name}", guest.name);
  const checkIn =
    settings.checkInMode === "link"
      ? `Your ticket: ${ticketUrl(origin, guest)}`
      : "Present the QR code on your invitation at check-in.";
  return `${greeting}\n\n${checkIn}\n\nRSVP:\nYes, I will attend: ${rsvpUrl(origin, guest, "yes")}\nNo, I can’t attend: ${rsvpUrl(origin, guest, "no")}`;
}

export function needsCustomQr(settings: InviteSettings, guest: Guest) {
  return settings.checkInMode === "qr" && settings.qrMode === "custom" && !guest.hasCustomQrImage && !guest.customQrValue;
}

// ---------------------------------------------------------------------------
// Drawing

export const INVITE_WIDTH = 1122;
export const INVITE_HEIGHT = 1402;
/** Where the QR code and name sit on the 1122×1402 invitation, in pixels. */
export const LAYOUT = {
  qr: { x: 464, y: 1063, size: 183 },
  link: { x: 352, y: 1078, w: 418, h: 132 },
  name: { x: 395, y: 1252, w: 332, h: 58 },
};
export const NAME_MAX_WIDTH = 820;

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("An invitation image could not be loaded."));
    image.src = src;
  });
}

/** Shrinks text until it fits `maxWidth`, so long names are never cut off. */
function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, start: number, min: number, weight = 700) {
  let size = start;
  ctx.font = `${weight} ${size}px Arial`;
  while (size > min && ctx.measureText(value).width > maxWidth) {
    size -= 1;
    ctx.font = `${weight} ${size}px Arial`;
  }
  return size;
}

export async function drawInvite({
  settings,
  guest,
  eventName,
  flyerUrl,
  qrSrc,
}: {
  settings: InviteSettings;
  guest: Guest;
  eventName: string;
  flyerUrl: string | null;
  qrSrc: string;
}) {
  const W = INVITE_WIDTH;
  const H = INVITE_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Invitation image could not be created.");

  if (flyerUrl) {
    const image = await loadImage(flyerUrl);
    const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight) * settings.flyerZoom;
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    const drawX = -(Math.max(0, drawWidth - W) * settings.flyerX) / 100;
    const drawY = -(Math.max(0, drawHeight - H) * settings.flyerY) / 100;
    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, "#191612");
    gradient.addColorStop(0.65, "#30291f");
    gradient.addColorStop(1, "#9e4a12");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    fitText(ctx, eventName.toUpperCase(), W - 160, 86, 36);
    ctx.fillText(eventName.toUpperCase(), W / 2, 520);
    ctx.fillStyle = "#f58220";
    ctx.font = "700 30px Arial";
    ctx.fillText("YOU ARE INVITED", W / 2, 420);
  }

  if (settings.pattern !== "none") {
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = "#f58220";
    ctx.fillStyle = "#f58220";
    ctx.lineWidth = 2;
    if (settings.pattern === "dots") {
      for (let y = 22; y < H; y += 42)
        for (let x = 22; x < W; x += 42) {
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
    } else if (settings.pattern === "weave") {
      for (let x = -H; x < W; x += 58) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + H, H);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + 28, 0);
        ctx.lineTo(x + 28 - H, H);
        ctx.stroke();
      }
    } else {
      for (let y = 0; y < H; y += 72)
        for (let x = 0; x < W; x += 72) {
          ctx.beginPath();
          ctx.moveTo(x + 36, y);
          ctx.lineTo(x + 72, y + 36);
          ctx.lineTo(x + 36, y + 72);
          ctx.lineTo(x, y + 36);
          ctx.closePath();
          ctx.stroke();
        }
    }
    ctx.restore();
  }

  if (settings.watermarkEnabled && settings.watermarkText.trim()) {
    ctx.save();
    ctx.globalAlpha = settings.watermarkOpacity / 100;
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 34px Arial";
    ctx.textAlign = "center";
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-Math.PI / 6);
    for (let y = -700; y <= 700; y += 180)
      for (let x = -700; x <= 700; x += 360) ctx.fillText(settings.watermarkText.toUpperCase(), x, y);
    ctx.restore();
  }

  if (settings.checkInMode === "qr") {
    if (!qrSrc) throw new Error(`No QR code is available for ${guest.name}. Upload one or switch to generated QR codes.`);
    const qrImage = await loadImage(qrSrc);
    const { x, y, size } = LAYOUT.qr;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, y, size, size);
    ctx.drawImage(qrImage, x, y, size, size);
  } else {
    const { x, y, w, h } = LAYOUT.link;
    ctx.fillStyle = "rgba(255,255,255,.96)";
    ctx.fillRect(x, y, w, h);
    ctx.textAlign = "center";
    ctx.fillStyle = "#171512";
    ctx.font = "700 25px Arial";
    ctx.fillText("CHECK IN WITH YOUR LINK", x + w / 2, y + 47);
    ctx.fillStyle = "#c45d0b";
    ctx.font = "600 22px Arial";
    ctx.fillText(guest.ticketCode, x + w / 2, y + 85);
    ctx.fillStyle = "#555555";
    ctx.font = "16px Arial";
    ctx.fillText("Link included in your message", x + w / 2, y + 117);
  }

  // The name band widens for long names (up to NAME_MAX_WIDTH), then the text shrinks if still needed.
  const { y, w, h } = LAYOUT.name;
  const name = guest.name.toUpperCase();
  ctx.textAlign = "center";
  ctx.font = "700 28px Arial";
  const bandWidth = Math.min(NAME_MAX_WIDTH, Math.max(w, ctx.measureText(name).width + 48));
  const size = fitText(ctx, name, bandWidth - 32, 28, 16);
  ctx.fillStyle = "rgba(35,12,3,.92)";
  ctx.fillRect((W - bandWidth) / 2, y, bandWidth, h);
  ctx.fillStyle = "#df7a18";
  ctx.font = `700 ${size}px Arial`;
  ctx.fillText(name, W / 2, y + h / 2 + size * 0.36);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Invitation image could not be created."))), "image/png"),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const inviteFilename = (guest: Guest) =>
  `${guest.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "guest"}-invite.png`;

/** Re-encodes an uploaded flyer as a JPEG small enough for the database (under ~1.8 MB). */
export async function compressFlyer(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    for (const [maxSide, quality] of [
      [2400, 0.9],
      [2000, 0.85],
      [1700, 0.8],
      [1400, 0.75],
      [1200, 0.65],
    ] as const) {
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size < 1_800_000) return blob;
    }
    throw new Error("This flyer image is too large. Please use a smaller image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
