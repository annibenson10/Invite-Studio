"use client";

import { Copy, Download, ExternalLink, ImagePlus, Mail, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { formatPhone } from "@/lib/country-codes";
import { INVITE_HEIGHT, INVITE_WIDTH, LAYOUT, NAME_MAX_WIDTH, buildMessage } from "@/lib/invite";
import { useStudio } from "./context";
import { Avatar, PlainSelect, Segmented } from "./ui";
import { NativeSelectOption } from "@/components/ui/native-select";

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

const PATTERNS = {
  dots: { backgroundImage: "radial-gradient(#ee6a1f 1.5px, transparent 1.5px)", backgroundSize: "20px 20px" },
  weave: { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 18px, rgba(238,106,31,.65) 19px 20px), repeating-linear-gradient(-45deg, transparent 0 18px, rgba(238,106,31,.35) 19px 20px)" },
  diamonds: { backgroundImage: "linear-gradient(45deg, transparent 45%, rgba(238,106,31,.65) 46% 54%, transparent 55%), linear-gradient(-45deg, transparent 45%, rgba(238,106,31,.65) 46% 54%, transparent 55%)", backgroundSize: "34px 34px" },
} as const;

/** The personalised flyer exactly as guests will receive it (mirrors drawInvite). */
export function InvitationVisual() {
  const { settings, event, selected, flyerUrl, previewQr, actions } = useStudio();
  const nameLength = selected?.name.length ?? 0;
  const estimatedTextWidth = nameLength * 1.75;
  const bandWidth = Math.min((NAME_MAX_WIDTH / INVITE_WIDTH) * 100, Math.max((LAYOUT.name.w / INVITE_WIDTH) * 100, estimatedTextWidth + 4.3));
  const nameFont = `${Math.max(1.43, 2.5 * Math.min(1, (bandWidth - 2.9) / Math.max(1, estimatedTextWidth)))}cqw`;

  return (
    <div className="relative aspect-[1122/1402] w-full overflow-hidden rounded-2xl bg-night [container-type:inline-size]">
      {flyerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flyerUrl}
          alt={`${event.name} flyer`}
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: `${settings.flyerX}% ${settings.flyerY}%`, transform: `scale(${settings.flyerZoom})`, transformOrigin: `${settings.flyerX}% ${settings.flyerY}%` }}
        />
      ) : (
        <button onClick={actions.pickFlyer} className="invite-card absolute inset-0 flex flex-col items-center px-[8%] pt-[26%] text-center text-white">
          <span className="text-[2.8cqw] font-bold tracking-[.25em] text-brand">YOU ARE INVITED</span>
          <span className="mt-[3%] text-[7cqw] font-extrabold uppercase leading-[1.05]">{event.name}</span>
          <span className="mt-[7%] flex items-center gap-1.5 rounded-full bg-white/15 px-[4cqw] py-[1.6cqw] text-[3.2cqw] font-semibold backdrop-blur">
            <ImagePlus className="size-[4cqw]" /> Upload your flyer
          </span>
        </button>
      )}
      {settings.pattern !== "none" && <div className="pointer-events-none absolute inset-0 opacity-20" style={PATTERNS[settings.pattern]} />}
      {settings.watermarkEnabled && settings.watermarkText.trim() && (
        <div className="pointer-events-none absolute inset-0 flex -rotate-[28deg] items-center justify-center overflow-hidden" style={{ opacity: settings.watermarkOpacity / 100 }}>
          <span className="whitespace-nowrap text-[3cqw] font-bold tracking-[.2em] text-white">{settings.watermarkText.toUpperCase()}</span>
        </div>
      )}
      {settings.checkInMode === "qr" ? (
        previewQr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewQr} alt={`QR code for ${selected?.name ?? "guest"}`} className="absolute bg-white" style={{ left: pct(LAYOUT.qr.x, INVITE_WIDTH), top: pct(LAYOUT.qr.y, INVITE_HEIGHT), width: pct(LAYOUT.qr.size, INVITE_WIDTH) }} />
        ) : (
          <button
            className="absolute grid aspect-square place-items-center bg-white text-[1.6cqw] font-bold leading-tight text-black/45"
            style={{ left: pct(LAYOUT.qr.x, INVITE_WIDTH), top: pct(LAYOUT.qr.y, INVITE_HEIGHT), width: pct(LAYOUT.qr.size, INVITE_WIDTH) }}
            onClick={actions.pickQrFiles}
          >
            {selected ? <>UPLOAD<br />QR</> : "QR"}
          </button>
        )
      ) : (
        <div className="absolute flex flex-col items-center justify-center bg-white/95 text-center text-black" style={{ left: pct(LAYOUT.link.x, INVITE_WIDTH), top: pct(LAYOUT.link.y, INVITE_HEIGHT), width: pct(LAYOUT.link.w, INVITE_WIDTH), height: pct(LAYOUT.link.h, INVITE_HEIGHT) }}>
          <span className="text-[2.2cqw] font-bold">CHECK IN WITH YOUR LINK</span>
          <span className="text-[2cqw] font-semibold text-brand-ink">{selected?.ticketCode ?? "ABC-123"}</span>
        </div>
      )}
      <div className="absolute flex -translate-x-1/2 items-center justify-center overflow-hidden bg-[#230c03]/95" style={{ left: "50%", top: pct(LAYOUT.name.y, INVITE_HEIGHT), width: `${bandWidth}%`, height: pct(LAYOUT.name.h, INVITE_HEIGHT) }}>
        <span className="whitespace-nowrap text-center font-bold uppercase text-[#df7a18]" style={{ fontSize: nameFont }}>{selected?.name ?? "Guest name"}</span>
      </div>
    </div>
  );
}

/** Phone-style preview of the message the selected guest will receive, with quick actions. */
export function PreviewPanel({ showGuestPicker = true, showHeading = true }: { showGuestPicker?: boolean; showHeading?: boolean }) {
  const { settings, selected, guests, origin, selectGuest, actions, busy } = useStudio();
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const activeChannel = settings.deliveryMode === "both" ? channel : "whatsapp";
  const message = selected ? buildMessage(settings, selected, origin || "https://your-site") : "";
  const sendMode = settings.deliveryMode === "both" ? "both" : "whatsapp";

  return (
    <div className="space-y-3">
      <div className={`items-center justify-between gap-3 px-1 ${showHeading ? "flex" : "hidden"}`}>
        <div>
          <p className="font-bold tracking-tight">Live preview</p>
          <p className="text-xs text-ink-3">Exactly what {selected ? selected.name.split(" ")[0] : "each guest"} receives</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
          <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
        </span>
      </div>

      {showGuestPicker && guests.length > 1 && selected && (
        <PlainSelect label="Preview guest" value={selected.id} onChange={selectGuest}>
          {guests.map((guest) => <NativeSelectOption key={guest.id} value={guest.id}>{guest.name}</NativeSelectOption>)}
        </PlainSelect>
      )}
      {settings.deliveryMode === "both" && (
        <Segmented
          label="Preview channel"
          value={channel}
          onChange={setChannel}
          options={[
            { value: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={15} /> },
            { value: "email", label: "Email", icon: <Mail size={15} /> },
          ]}
        />
      )}

      <div className="overflow-hidden rounded-[30px] border-[6px] border-night bg-night shadow-[var(--shadow-float)]">
        {activeChannel === "whatsapp" ? (
          <div className="bg-[#e9e3da]">
            <div className="flex items-center gap-3 bg-[#0b5c4f] px-4 py-3 text-white">
              {selected ? <Avatar name={selected.name} size={34} /> : <span className="size-[34px] rounded-full bg-white/20" />}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{selected?.name ?? "Your guest"}</p>
                <p className="truncate text-[11px] text-white/70">{selected ? formatPhone(selected.whatsapp) || "No WhatsApp number" : "Add a guest to preview"}</p>
              </div>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-3">
              <div className="ml-auto w-[92%] rounded-2xl rounded-tr-md bg-[#d9fdd3] p-1.5 shadow-sm">
                <InvitationVisual />
                {selected && <p className="whitespace-pre-wrap break-words px-1.5 pb-1 pt-2.5 text-[13px] leading-[1.45] text-[#111b21]">{message}</p>}
                <p className="px-1.5 text-right text-[10px] text-black/40">12:00 ✓✓</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#f3f4f6]">
            <div className="border-b border-black/5 bg-white px-4 py-3">
              <p className="truncate text-[11px] text-ink-3">To: {selected?.email || "Email address required"}</p>
              <p className="mt-0.5 truncate text-sm font-bold">{settings.emailSubject}</p>
            </div>
            <div className="max-h-[560px] overflow-y-auto p-3">
              <div className="overflow-hidden rounded-xl bg-white p-2 shadow-sm">
                <InvitationVisual />
                {selected && <p className="whitespace-pre-wrap break-words p-2 text-[13px] leading-[1.5] text-ink-2">{message}</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="grid gap-2">
          <button
            onClick={() => actions.sendInvite(selected, sendMode)}
            disabled={busy}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-success text-[15px] font-bold text-white shadow-sm transition hover:brightness-110 active:scale-[.99] disabled:opacity-60"
          >
            <Send size={17} /> Send to {selected.name.split(" ")[0]}
          </button>
          <div className="grid grid-cols-3 gap-2">
            <QuickAction icon={<Download size={16} />} label="Download" onClick={() => actions.downloadInvite(selected)} />
            <QuickAction icon={<Copy size={16} />} label="Copy text" onClick={() => actions.copyMessage(selected)} />
            <QuickAction icon={<ExternalLink size={16} />} label="Ticket" onClick={() => actions.openTicket(selected)} />
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-11 items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface text-[13px] font-semibold text-ink-2 transition hover:border-[#d9d4ca] hover:text-ink">
      {icon}
      {label}
    </button>
  );
}
