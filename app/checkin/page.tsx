import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, STAFF_COOKIE, isAdminCookie, staffEventFromCookie } from "@/lib/server/auth";
import { getEvent } from "@/lib/server/db";
import { CheckInApp } from "./scanner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Door check-in", robots: { index: false, follow: false } };

export default async function CheckInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const jar = await cookies();
  const requested = typeof query.event === "string" ? query.event : null;
  const admin = await isAdminCookie(jar.get(ADMIN_COOKIE)?.value);
  const staffEventId = await staffEventFromCookie(jar.get(STAFF_COOKIE)?.value);

  // The organiser can open any event's scanner directly from the dashboard.
  const eventId = admin && requested ? requested : staffEventId;
  const event = eventId ? await getEvent(eventId) : null;

  return <CheckInApp initialEventName={event?.name ?? null} eventParam={admin && requested && event ? requested : null} />;
}
