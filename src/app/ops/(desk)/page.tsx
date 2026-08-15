"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Overview = {
  seat: string;
  stats: {
    elders: number;
    vaults: number;
    openReviews: number;
    sealed: number;
    slaBreaches: number;
    pendingAdvocateApps: number;
    successionOpen: number;
    amendmentVolume: number;
    billingUnpaid: number;
    billingUnpaidKes: number;
  };
  slaAlerts: Array<{
    reviewId: string;
    vaultId: string;
    packageTier: string;
    kind: string;
    ageHours: number;
    thresholdHours: number;
    message: string;
    whatsappUrl: string;
  }>;
  successionPipeline: Array<{ status: string; count: number }>;
  elders: Array<{
    id: string;
    fullName: string;
    phone: string;
    createdAt: string;
    vaultId: string | null;
    vaultStatus: string | null;
    packageTier: string | null;
  }>;
  submissions: Array<{
    at: string;
    reviewId: string;
    vaultId: string;
    status: string;
    packageTier: string;
  }>;
};

export default function OpsOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/ops/overview");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load");
        return;
      }
      setData(json);
    })();
  }, []);

  if (error) return <p className="text-[#e07a5f]">{error}</p>;
  if (!data) return <p className="text-[#9aa89c]">Loading ops desk…</p>;

  const kpi = [
    ["Open reviews", data.stats.openReviews],
    ["SLA breaches", data.stats.slaBreaches],
    ["Succession open", data.stats.successionOpen],
    ["Advocate apps", data.stats.pendingAdvocateApps],
    ["Amendments billed", data.stats.amendmentVolume],
    ["Unpaid (KES)", data.stats.billingUnpaidKes.toLocaleString()],
    ["Elders", data.stats.elders],
    ["Sealed", data.stats.sealed],
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Operations overview</h1>
        <p className="mt-2 text-[#9aa89c]">
          Phase 6 desk · your seat:{" "}
          <span className="font-semibold text-[#d4a574]">{data.seat || "super"}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {kpi.map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded border border-[#3d4a40] bg-[#121a16] p-4"
          >
            <p className="text-sm text-[#9aa89c]">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-[#e8efe9]">{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded border border-[#e07a5f]/40 bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold text-[#e07a5f]">SLA alerts</h2>
        <p className="mt-1 text-sm text-[#9aa89c]">
          Unassigned &gt;24h or in-review &gt;72h. Open WhatsApp to ping the team.
        </p>
        <ul className="mt-4 space-y-3">
          {data.slaAlerts.length === 0 && (
            <li className="text-[#9aa89c]">No breaches right now.</li>
          )}
          {data.slaAlerts.map((a) => (
            <li
              key={a.reviewId}
              className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-[#e07a5f] pl-3 text-sm"
            >
              <div>
                <p className="font-semibold capitalize">
                  {a.packageTier} · {a.kind.replace("_", " ")} · {a.ageHours}h
                </p>
                <Link
                  href={`/ops/vaults/${a.vaultId}`}
                  className="text-[#d4a574] underline"
                >
                  Open vault
                </Link>
              </div>
              <a
                href={a.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-[#0f1411]"
              >
                WhatsApp alert
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
          <h2 className="text-xl font-semibold">Succession pipeline</h2>
          <ul className="mt-4 space-y-2">
            {data.successionPipeline.map((s) => (
              <li
                key={s.status}
                className="flex justify-between text-sm capitalize text-[#e8efe9]"
              >
                <span>{s.status.replace(/_/g, " ")}</span>
                <span className="font-semibold text-[#d4a574]">{s.count}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/ops/succession"
            className="mt-4 inline-block text-sm text-[#d4a574] underline"
          >
            Open succession desk
          </Link>
        </div>

        <div className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
          <h2 className="text-xl font-semibold">Latest submissions</h2>
          <ul className="mt-4 space-y-3">
            {data.submissions.slice(0, 8).map((s) => (
              <li key={s.reviewId} className="border-l-2 border-[#d4a574] pl-3 text-sm">
                <p className="font-semibold capitalize">
                  {s.packageTier} · {s.status}
                </p>
                <p className="text-[#9aa89c]">
                  {new Date(s.at).toLocaleString()}
                </p>
                <Link
                  href={`/ops/vaults/${s.vaultId}`}
                  className="text-[#d4a574] underline"
                >
                  Open vault
                </Link>
              </li>
            ))}
            {data.submissions.length === 0 && (
              <li className="text-[#9aa89c]">No submissions yet.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Quick links</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["/ops/elders", "Elder inspector"],
            ["/ops/billing", "Billing desk"],
            ["/ops/title-lookups", "Title ledger"],
            ["/ops/advocates-crm", "Advocate CRM"],
            ["/ops/retention", "Doc retention"],
            ["/ops/advocates", "Applications"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded border border-[#3d4a40] px-3 py-2 text-sm font-semibold hover:border-[#d4a574]"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
