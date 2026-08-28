"use client";

import { useEffect, useState } from "react";

type Notice = {
  id: string;
  channel: string;
  toPhone: string;
  body: string;
  status: string;
  relatedAction: string;
  createdAt: string;
  whatsappUrl: string;
  error: string | null;
};

type Dispute = {
  vaultId: string;
  ownerName: string;
  phone: string;
  asset: {
    id: string;
    title: string;
    titleNumber: string;
    disputeFlag: boolean;
    familyAlert: boolean;
    disputeNotes: string;
  };
};

export default function OpsAlertsPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [disputed, setDisputed] = useState<Dispute[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/ops/alerts");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed");
        return;
      }
      setNotices(json.notices || []);
      setDisputed(json.disputed || []);
    })();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Alerts & notices</h1>
        <p className="mt-2 text-[#9aa89c]">
          Caveats flagged by elders, plus SMS/WhatsApp status messages. SMS
          sends when an Africa’s Talking key is configured; otherwise ops sends
          via WhatsApp.
        </p>
      </div>
      {error && <p className="text-[#e07a5f]">{error}</p>}
      <section>
        <h2 className="text-xl font-semibold">Title protection</h2>
        <ul className="mt-3 space-y-3">
          {disputed.map((row) => (
            <li
              key={row.asset.id}
              className="rounded border border-[#B22222]/40 bg-[#121a16] p-4"
            >
              <p className="font-semibold">
                {row.asset.title}{" "}
                {row.asset.titleNumber ? `· ${row.asset.titleNumber}` : ""}
              </p>
              <p className="text-sm text-[#9aa89c]">
                {row.ownerName} · {row.phone}
                {row.asset.disputeFlag ? " · dispute/caveat" : ""}
                {row.asset.familyAlert ? " · family alert" : ""}
              </p>
              {row.asset.disputeNotes ? (
                <p className="mt-1 text-sm">{row.asset.disputeNotes}</p>
              ) : null}
            </li>
          ))}
          {disputed.length === 0 && (
            <li className="text-[#9aa89c]">No flagged parcels.</li>
          )}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">Outbound SMS / WhatsApp</h2>
        <ul className="mt-3 space-y-3">
          {notices.slice(0, 40).map((n) => (
            <li
              key={n.id}
              className="rounded border border-[#1E293B] bg-[#121a16] p-4"
            >
              <p className="text-sm capitalize text-[#9aa89c]">
                {n.channel} · {n.status} · {n.relatedAction}
              </p>
              <p className="mt-1">{n.body}</p>
              <p className="mt-1 text-sm text-[#9aa89c]">{n.toPhone}</p>
              {n.error ? (
                <p className="text-sm text-[#d4a574]">{n.error}</p>
              ) : null}
              <a
                href={n.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-[#16A34A] underline"
              >
                Send on WhatsApp
              </a>
            </li>
          ))}
          {notices.length === 0 && (
            <li className="text-[#9aa89c]">No notices queued yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
