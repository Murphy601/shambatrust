"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ConsultBooking } from "@/lib/db/types";

export default function AdvocateCalendarPage() {
  const [bookings, setBookings] = useState<ConsultBooking[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/advocate/calendar");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed");
        return;
      }
      setBookings(json.bookings || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">Calendar</h1>
        <p className="mt-2 text-muted">
          Upcoming WhatsApp, video, and in-person consults.
        </p>
      </div>
      {error && <p className="text-[var(--danger)]">{error}</p>}
      <ul className="space-y-3">
        {bookings.map((b) => (
          <li
            key={b.id}
            className="rounded-[0.45rem] border-2 border-border bg-surface p-5"
          >
            <p className="text-lg font-semibold capitalize text-forest-deep">
              {b.mode.replace("_", " ")} · {b.status}
            </p>
            <p className="mt-1 text-muted">
              {new Date(b.scheduledAt).toLocaleString()}
            </p>
            {b.notes && <p className="mt-2 text-ink">{b.notes}</p>}
            {b.kind === "video_notarization" && (
              <p className="mt-2 text-base text-ink">
                Video notarization
                {b.diasporaSignerName ? ` · ${b.diasporaSignerName}` : ""}
              </p>
            )}
            {b.reviewRequestId ? (
              <Link
                href={`/advocate/cases/${b.reviewRequestId}`}
                className="mt-3 inline-block font-semibold text-forest underline"
              >
                Open case
              </Link>
            ) : (
              <p className="mt-3 text-sm text-muted">No linked review case.</p>
            )}
          </li>
        ))}
        {bookings.length === 0 && !error && (
          <li className="text-muted">No consults scheduled yet.</li>
        )}
      </ul>
    </div>
  );
}
