"use client";

import type { ReactNode } from "react";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { GUEST_CATEGORIES, allCountries, featuredCountries } from "@/lib/country-codes";

/** Small presentational building blocks shared by the dashboard panels. */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-surface shadow-[var(--shadow-card)] ${className}`}>{children}</section>;
}

export function CardHeader({ title, description, action, icon }: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 p-5 pb-0 sm:p-6 sm:pb-0">
      <div className="flex min-w-0 gap-3">
        {icon && <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-ink">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-ink-2">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 [&_[data-slot=native-select-wrapper]]:w-full ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-5 text-ink-3">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] outline-none transition placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand/15 disabled:opacity-50";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

const selectClass = "h-12 rounded-2xl border-line bg-surface text-[15px]";

export function CountrySelect({ value, onChange, label = "Country code" }: { value: string; onChange: (code: string) => void; label?: string }) {
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className={selectClass}>
      <NativeSelectOptGroup label="Common">
        {featuredCountries.map(([country, code]) => (
          <NativeSelectOption key={`f-${country}`} value={code}>{code} {country}</NativeSelectOption>
        ))}
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="All countries">
        {allCountries.map(([country, code]) => (
          <NativeSelectOption key={country} value={code}>{code} {country}</NativeSelectOption>
        ))}
      </NativeSelectOptGroup>
    </NativeSelect>
  );
}

export function CategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = GUEST_CATEGORIES.includes(value as (typeof GUEST_CATEGORIES)[number]) ? GUEST_CATEGORIES : [...GUEST_CATEGORIES, value];
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)} aria-label="Category" className={selectClass}>
      {options.map((option) => <NativeSelectOption key={option} value={option}>{option}</NativeSelectOption>)}
    </NativeSelect>
  );
}

export function PlainSelect({ value, onChange, children, label }: { value: string; onChange: (value: string) => void; children: ReactNode; label: string }) {
  return (
    <NativeSelect value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} className={selectClass}>
      {children}
    </NativeSelect>
  );
}

/** A row of mutually exclusive options that looks like an iOS segmented control. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl bg-[#f0ede7] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
            value === option.value ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
          }`}
        >
          {option.icon}
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Larger selectable cards for choices that need a description. */
export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), onSelect())}
      className={`relative cursor-pointer rounded-2xl border-2 p-4 text-left transition outline-none focus-visible:ring-4 focus-visible:ring-brand/20 ${
        selected ? "border-brand bg-brand-soft/60" : "border-line bg-surface hover:border-[#d9d4ca]"
      }`}
    >
      <div className="flex items-start gap-3">
        {icon && <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${selected ? "bg-brand text-white" : "bg-[#f0ede7] text-ink-2"}`}>{icon}</span>}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm leading-5 text-ink-2">{description}</p>
          {children}
        </div>
        <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-brand" : "border-[#d0cbc1]"}`}>
          {selected && <span className="size-2.5 rounded-full bg-brand" />}
        </span>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-[#dcd8cf]"}`}
    >
      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`} />
    </button>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, display, disabled }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; display?: string; disabled?: boolean }) {
  return (
    <label className={`block ${disabled ? "opacity-40" : ""}`}>
      <span className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium text-ink-2">{label}</span>
        {display && <span className="rounded-full bg-[#f0ede7] px-2 py-0.5 text-xs font-bold tabular-nums">{display}</span>}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} className="w-full" />
    </label>
  );
}

export function ProgressBar({ value, total, tone = "brand" }: { value: number; total: number; tone?: "brand" | "success" }) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#efece6]" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full transition-all duration-500 ${tone === "success" ? "bg-success" : "bg-brand"}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

const AVATAR_TONES = ["#fde4d2", "#dcefe3", "#e3e4fb", "#fbe3ef", "#e1f1f7", "#f3ecd3", "#ece2f8"];

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full text-[13px] font-bold text-ink/80"
      style={{ width: size, height: size, background: AVATAR_TONES[hash % AVATAR_TONES.length] }}
      aria-hidden
    >
      {initials || "?"}
    </span>
  );
}

export function Pill({ tone, children }: { tone: "neutral" | "success" | "danger" | "brand" | "muted"; children: ReactNode }) {
  const tones = {
    neutral: "bg-[#f0ede7] text-ink-2",
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    brand: "bg-brand-soft text-brand-ink",
    muted: "bg-transparent text-ink-3 ring-1 ring-inset ring-line",
  };
  return <span className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
