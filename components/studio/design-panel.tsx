"use client";

import { Frame, ImagePlus, QrCode, RotateCcw, Sparkles, Trash2, UploadCloud } from "lucide-react";
import type { Pattern } from "@/lib/invite";
import { useStudio } from "./context";
import { Card, CardBody, CardHeader, ChoiceCard, Pill, Slider, TextInput, Toggle } from "./ui";

const PATTERN_SWATCHES: Record<Pattern, React.CSSProperties> = {
  none: {},
  dots: { backgroundImage: "radial-gradient(#ee6a1f 1px, transparent 1px)", backgroundSize: "8px 8px" },
  weave: { backgroundImage: "repeating-linear-gradient(45deg, transparent 0 7px, #ee6a1f 8px 9px), repeating-linear-gradient(-45deg, transparent 0 7px, rgba(238,106,31,.5) 8px 9px)" },
  diamonds: { backgroundImage: "linear-gradient(45deg, transparent 42%, #ee6a1f 43% 57%, transparent 58%), linear-gradient(-45deg, transparent 42%, #ee6a1f 43% 57%, transparent 58%)", backgroundSize: "14px 14px" },
};

export function DesignPanel() {
  const { settings, updateSettings, flyerUrl, event, guests, actions, busy } = useStudio();
  const matched = guests.filter((guest) => guest.hasCustomQrImage || guest.customQrValue).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader icon={<ImagePlus size={18} />} title="Flyer" description="The artwork every invitation is built on. Each guest’s name and QR code are added near the bottom." />
        <CardBody>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <button onClick={actions.pickFlyer} className="group relative mx-auto aspect-[1122/1402] w-36 shrink-0 overflow-hidden rounded-2xl bg-night shadow-[var(--shadow-card)] sm:mx-0" aria-label={flyerUrl ? "Replace flyer" : "Upload flyer"}>
              {flyerUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={flyerUrl} alt={`${event.name} flyer`} className="size-full object-cover transition group-hover:scale-105" />
              ) : (
                <span className="invite-card flex size-full flex-col items-center justify-center gap-2 text-xs font-semibold text-white/80">
                  <ImagePlus size={22} /> No flyer yet
                </span>
              )}
            </button>
            <div className="min-w-0 flex-1 space-y-3">
              <ul className="space-y-1.5 text-sm text-ink-2">
                <li>• A <span className="font-semibold text-ink">portrait</span> image works best (about 4 : 5).</li>
                <li>• Leave the <span className="font-semibold text-ink">lower middle</span> clear for the QR code and name.</li>
                <li>• JPG or PNG. Large images are compressed automatically.</li>
              </ul>
              <div className="flex flex-wrap gap-2">
                <button onClick={actions.pickFlyer} disabled={busy} className="flex h-11 items-center gap-2 rounded-2xl bg-ink px-4 text-sm font-bold text-white hover:bg-black disabled:opacity-50">
                  <UploadCloud size={16} /> {flyerUrl ? "Replace flyer" : "Upload flyer"}
                </button>
                {flyerUrl && (
                  <button onClick={actions.removeFlyer} className="flex h-11 items-center gap-2 rounded-2xl border border-line px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2">
                    <Trash2 size={16} /> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<Frame size={18} />}
          title="Framing"
          description="Zoom and move the flyer if its edges get cropped."
          action={
            <button onClick={() => updateSettings({ flyerZoom: 1, flyerX: 50, flyerY: 50 })} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2">
              <RotateCcw size={14} /> Reset
            </button>
          }
        />
        <CardBody className="grid gap-5 sm:grid-cols-3">
          <Slider label="Zoom" min={1} max={2} step={0.05} value={settings.flyerZoom} onChange={(value) => updateSettings({ flyerZoom: value })} display={`${Math.round(settings.flyerZoom * 100)}%`} />
          <Slider label="Left / right" min={0} max={100} value={settings.flyerX} onChange={(value) => updateSettings({ flyerX: value })} disabled={settings.flyerZoom === 1} />
          <Slider label="Up / down" min={0} max={100} value={settings.flyerY} onChange={(value) => updateSettings({ flyerY: value })} disabled={settings.flyerZoom === 1} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<Sparkles size={18} />} title="Finishing touches" description="Optional. Keep them subtle so the flyer stays readable." />
        <CardBody className="space-y-6">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Watermark</p>
                <p className="text-sm text-ink-2">Faint repeated text across the flyer.</p>
              </div>
              <Toggle checked={settings.watermarkEnabled} onChange={(checked) => updateSettings({ watermarkEnabled: checked })} label="Watermark" />
            </div>
            {settings.watermarkEnabled && (
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_200px] sm:items-end">
                <TextInput value={settings.watermarkText} onChange={(event) => updateSettings({ watermarkText: event.target.value })} placeholder="e.g. your brand name" aria-label="Watermark text" />
                <Slider label="Strength" min={3} max={20} value={settings.watermarkOpacity} onChange={(value) => updateSettings({ watermarkOpacity: value })} display={`${settings.watermarkOpacity}%`} />
              </div>
            )}
          </div>
          <div>
            <p className="font-semibold">Pattern overlay</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {(["none", "dots", "weave", "diamonds"] as Pattern[]).map((option) => (
                <button
                  key={option}
                  onClick={() => updateSettings({ pattern: option })}
                  aria-pressed={settings.pattern === option}
                  className={`rounded-2xl border-2 p-1.5 text-center transition ${settings.pattern === option ? "border-brand" : "border-transparent hover:border-line"}`}
                >
                  <span className={`block h-12 rounded-xl ${option === "none" ? "bg-[#efece6]" : "bg-[#25140c]"}`} style={PATTERN_SWATCHES[option]} />
                  <span className="mt-1.5 block text-xs font-semibold capitalize">{option}</span>
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader icon={<QrCode size={18} />} title="QR codes" description="What the door scanner reads when guests arrive." />
        <CardBody className="grid gap-3 md:grid-cols-2" >
          <ChoiceCard
            selected={settings.qrMode === "automatic"}
            onSelect={() => updateSettings({ qrMode: "automatic" })}
            title="Generate for me"
            description="A unique, unguessable code for every guest. Works with the built-in scanner. Recommended."
          />
          <ChoiceCard
            selected={settings.qrMode === "custom"}
            onSelect={() => updateSettings({ qrMode: "custom" })}
            title="Use my own QR images"
            description="Name each image after the guest’s ticket code, name or phone number."
          >
            {settings.qrMode === "custom" && (
              <div className="mt-3 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                <button onClick={actions.pickQrFiles} disabled={busy} className="flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 text-sm font-bold text-white disabled:opacity-50">
                  <UploadCloud size={15} /> Upload images
                </button>
                <Pill tone={matched === guests.length && guests.length ? "success" : "neutral"}>{matched}/{guests.length} matched</Pill>
              </div>
            )}
          </ChoiceCard>
        </CardBody>
      </Card>
    </div>
  );
}
