import { Sparkles } from "lucide-react";

export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white shadow-[0_6px_16px_-6px_rgba(238,106,31,.7)]">
        <Sparkles size={18} />
      </span>
      {!compact && <span className={`text-[17px] font-bold tracking-tight ${dark ? "text-white" : "text-ink"}`}>Invite Studio</span>}
    </span>
  );
}
