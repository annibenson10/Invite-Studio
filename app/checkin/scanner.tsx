"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, LogOut, RotateCcw, Search, UserCheck } from "lucide-react";
import { api, formatTime } from "@/lib/client";

type Stats = { total: number; checkedIn: number; attending: number };
type ScanGuest = { id: string; name: string; category: string; ticketCode: string; rsvp: "yes" | "no" | null; checkedInAt: string | null };
type ScanResult =
  | { result: "checked_in" | "already_checked_in"; guest: ScanGuest; stats: Stats }
  | { result: "not_found"; stats: Stats };

export function CheckInApp({ initialEventName, eventParam }: { initialEventName: string | null; eventParam: string | null }) {
  const [eventName, setEventName] = useState(initialEventName);
  if (!eventName) return <PinForm onSignedIn={setEventName} />;
  return <Scanner eventName={eventName} eventParam={eventParam} onSignedOut={() => setEventName(null)} />;
}

function PinForm({ onSignedIn }: { onSignedIn: (eventName: string) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ eventName: string }>("/api/checkin/login", { method: "POST", json: { pin } });
      onSignedIn(result.eventName);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#171512] p-4 text-white">
      <form onSubmit={submit} className="w-full max-w-sm rounded-[26px] bg-white p-7 text-center text-[#171512]">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f58220] text-white">
          <UserCheck size={26} />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Door check-in</h1>
        <p className="mt-2 text-sm text-black/55">Enter the 6-digit event PIN the organiser gave you.</p>
        <input
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label="Event PIN"
          placeholder="••••••"
          className="mt-6 w-full rounded-xl border border-black/15 px-4 py-4 text-center font-mono text-3xl tracking-[.4em] outline-none focus:border-[#f58220]"
        />
        {error && <p className="mt-3 text-sm font-semibold text-[#a6372f]">{error}</p>}
        <button disabled={busy || pin.length !== 6} className="mt-5 w-full rounded-xl bg-[#f58220] py-4 font-bold text-white disabled:opacity-50">
          {busy ? "Checking…" : "Start scanning"}
        </button>
      </form>
    </main>
  );
}

function Scanner({ eventName, eventParam, onSignedOut }: { eventName: string; eventParam: string | null; onSignedOut: () => void }) {
  const suffix = eventParam ? `?event=${encodeURIComponent(eventParam)}` : "";
  const withEvent = (path: string, extra = "") => `${path}${suffix}${extra && (suffix ? `&${extra}` : `?${extra}`)}`;
  const [stats, setStats] = useState<Stats | null>(null);
  const [last, setLast] = useState<ScanResult | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ScanGuest[]>([]);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const busyRef = useRef(false);
  const recentRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const handleError = useCallback(
    (caught: unknown) => {
      const status = (caught as { status?: number }).status;
      if (status === 401) onSignedOut();
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    },
    [onSignedOut],
  );

  useEffect(() => {
    api<{ stats: Stats }>(withEvent("/api/checkin/stats")).then((data) => setStats(data.stats)).catch(handleError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitCode = useCallback(
    async (code: string) => {
      if (busyRef.current) return;
      const now = Date.now();
      if (recentRef.current.code === code && now - recentRef.current.at < 4000) return;
      recentRef.current = { code, at: now };
      busyRef.current = true;
      try {
        const result = await api<ScanResult>(withEvent("/api/checkin/scan"), { method: "POST", json: { code } });
        setLast(result);
        setStats(result.stats);
        setError("");
        navigator.vibrate?.(result.result === "checked_in" ? 120 : [80, 60, 80]);
      } catch (caught) {
        handleError(caught);
      } finally {
        window.setTimeout(() => (busyRef.current = false), 1200);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleError],
  );

  // Camera loop: decode a frame roughly five times a second.
  useEffect(() => {
    if (!cameraOn) return;
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((track) => track.stop());
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        setCameraError("");
        const tick = () => {
          if (stopped) return;
          if (video.readyState >= 2 && video.videoWidth) {
            const canvas = (canvasRef.current ??= document.createElement("canvas"));
            const scale = Math.min(1, 720 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            const context = canvas.getContext("2d", { willReadFrequently: true })!;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = context.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
            if (found?.data) void submitCode(found.data);
          }
          timer = window.setTimeout(tick, 200);
        };
        tick();
      } catch {
        setCameraError(
          window.isSecureContext
            ? "Camera access was blocked. Allow camera access in your browser settings, or search by name below."
            : "The camera only works on a secure (https) address. Search by name below instead.",
        );
        setCameraOn(false);
      }
    })();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [cameraOn, submitCode]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setMatches([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api<{ guests: ScanGuest[] }>(withEvent("/api/checkin/search", `q=${encodeURIComponent(query.trim())}`))
        .then((data) => setMatches(data.guests))
        .catch(handleError);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, handleError]);

  async function checkInGuest(guest: ScanGuest) {
    try {
      const result = await api<ScanResult>(withEvent(`/api/checkin/guest/${guest.id}`), { method: "POST" });
      setLast(result);
      setStats(result.stats);
      setMatches((current) => current.map((item) => (item.id === guest.id && "guest" in result ? result.guest : item)));
    } catch (caught) {
      handleError(caught);
    }
  }

  async function undoCheckIn(guest: ScanGuest) {
    if (!window.confirm(`Undo check-in for ${guest.name}?`)) return;
    try {
      const result = await api<{ guest: ScanGuest; stats: Stats }>(withEvent(`/api/checkin/guest/${guest.id}`), { method: "DELETE" });
      setStats(result.stats);
      setLast(null);
      setMatches((current) => current.map((item) => (item.id === guest.id ? result.guest : item)));
      recentRef.current = { code: "", at: 0 };
    } catch (caught) {
      handleError(caught);
    }
  }

  async function signOut() {
    await api("/api/checkin/logout", { method: "POST" }).catch(() => undefined);
    onSignedOut();
  }

  return (
    <main className="min-h-screen bg-[#171512] text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-white/45">Door check-in</p>
          <h1 className="truncate text-lg font-bold">{eventName}</h1>
        </div>
        {!eventParam && (
          <button onClick={signOut} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/75">
            <LogOut size={15} /> Exit
          </button>
        )}
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 pb-10">
        {stats && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              [stats.checkedIn, "Checked in"],
              [stats.attending, "Said yes"],
              [stats.total, "Invited"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl bg-white/8 py-3">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-[11px] text-white/50">{label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="relative overflow-hidden rounded-[22px] bg-black">
          <video ref={videoRef} playsInline muted className={`aspect-square w-full object-cover ${cameraOn ? "" : "hidden"}`} />
          {cameraOn ? (
            <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-[#f58220]/80" />
          ) : (
            <button onClick={() => setCameraOn(true)} className="flex aspect-square w-full flex-col items-center justify-center gap-3 text-white/80">
              <span className="grid size-16 place-items-center rounded-full bg-[#f58220] text-white">
                <Camera size={28} />
              </span>
              <span className="font-semibold">Tap to start the camera</span>
              <span className="px-8 text-center text-xs text-white/45">Point it at the QR code on the guest’s invitation.</span>
            </button>
          )}
          {cameraOn && (
            <button onClick={() => setCameraOn(false)} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-lg bg-black/60 px-3 py-2 text-xs">
              <CameraOff size={14} /> Stop
            </button>
          )}
        </div>
        {cameraError && <p className="rounded-xl bg-[#a6372f]/25 px-4 py-3 text-sm text-red-100">{cameraError}</p>}

        {last && <ResultCard result={last} onUndo={undoCheckIn} />}
        {error && <p className="rounded-xl bg-[#a6372f]/25 px-4 py-3 text-sm text-red-100">{error}</p>}

        <div className="rounded-[22px] bg-white p-4 text-[#171512]">
          <p className="font-semibold">Can’t scan? Search by name or ticket code</p>
          <div className="relative mt-3">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. Ada or K7Q-2MX"
              aria-label="Search guests"
              className="h-12 w-full rounded-xl border border-black/12 bg-[#f7f6f2] pl-10 pr-3 outline-none focus:border-[#f58220]"
            />
          </div>
          {matches.length > 0 && (
            <ul className="mt-3 divide-y divide-black/8">
              {matches.map((guest) => (
                <li key={guest.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{guest.name}</p>
                    <p className="text-xs text-black/50">
                      {guest.ticketCode} · {guest.category} · {guest.rsvp === "yes" ? "Said yes" : guest.rsvp === "no" ? "Said no" : "No reply"}
                    </p>
                  </div>
                  {guest.checkedInAt ? (
                    <button onClick={() => undoCheckIn(guest)} className="shrink-0 rounded-lg bg-[#eaf8ef] px-3 py-2 text-xs font-bold text-[#167a3f]">
                      ✓ {formatTime(guest.checkedInAt)}
                    </button>
                  ) : (
                    <button onClick={() => checkInGuest(guest)} className="shrink-0 rounded-lg bg-[#171512] px-4 py-2 text-sm font-bold text-white">
                      Check in
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && matches.length === 0 && <p className="mt-3 text-sm text-black/45">No guests match “{query.trim()}”.</p>}
        </div>
      </div>
    </main>
  );
}

function ResultCard({ result, onUndo }: { result: ScanResult; onUndo: (guest: ScanGuest) => void }) {
  if (result.result === "not_found") {
    return (
      <div role="status" className="rounded-[22px] bg-[#a6372f] p-5">
        <p className="text-xl font-bold">✕ Not on the guest list</p>
        <p className="mt-1 text-sm text-white/80">This QR code doesn’t belong to this event. Try searching by name.</p>
      </div>
    );
  }
  const { guest } = result;
  const fresh = result.result === "checked_in";
  return (
    <div role="status" className={`rounded-[22px] p-5 ${fresh ? "bg-[#278237]" : "bg-[#c77a12]"}`}>
      <p className="text-sm font-bold uppercase tracking-[.12em] text-white/80">{fresh ? "✓ Welcome" : "⚠ Already checked in"}</p>
      <p className="mt-1 text-2xl font-bold">{guest.name}</p>
      <p className="mt-1 text-sm text-white/85">
        {guest.category} · {guest.ticketCode}
        {!fresh && guest.checkedInAt ? ` · first scanned ${formatTime(guest.checkedInAt)}` : ""}
      </p>
      {guest.rsvp === "no" && <p className="mt-2 rounded-lg bg-black/20 px-3 py-2 text-sm">Note: this guest RSVP’d “No”.</p>}
      {fresh && (
        <button onClick={() => onUndo(guest)} className="mt-3 flex items-center gap-1.5 text-sm text-white/80 underline underline-offset-4">
          <RotateCcw size={14} /> Undo
        </button>
      )}
    </div>
  );
}
