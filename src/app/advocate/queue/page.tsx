"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { advocateCopy } from "@/lib/advocate-copy";

type QueueItem = {
  id: string;
  vaultId: string;
  packageTier: string;
  consultMode: string;
  status: string;
  createdAt: string;
  ownerName: string;
  ownerPhone: string | null;
  vaultStatus: string | null;
  isMine: boolean;
  notes: string;
  counties: string[];
  slaAgeHours: number;
  urgency: "fresh" | "aging" | "urgent";
  isAmendment: boolean;
};

export default function AdvocateQueuePage() {
  const { locale } = useLocale();
  const t = advocateCopy(locale);
  const [reviews, setReviews] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    urgency: "",
    county: "",
    packageTier: "",
    reviewKind: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams(
        Object.entries(appliedFilters).filter(([, value]) => value),
      );
      const res = await fetch(`/api/advocate/reviews?${query.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load queue");
      setReviews(data.reviews || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  async function claim(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/reviews/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slaAccepted: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not claim");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim");
    } finally {
      setBusyId(null);
    }
  }

  const open = reviews.filter((r) => r.status === "submitted");
  const mine = reviews.filter(
    (r) => r.status === "assigned" && r.isMine,
  );
  const done = reviews.filter((r) => r.status === "completed");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep sm:text-4xl">
          {t.queueTitle}
        </h1>
        <p className="mt-2 text-lg text-muted">{t.queueSubtitle}</p>
        <p className="mt-2 text-base text-muted">
          Claiming a case accepts the partner SLA: view-only documents, no
          downloads, logged access, ends when sealed.
        </p>
      </div>

      {error && (
        <p className="text-base font-medium text-[var(--danger)]">{error}</p>
      )}
      <form
        className="grid gap-3 rounded-[0.45rem] border-2 border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedFilters(filters);
        }}
      >
        <select
          className="field"
          aria-label="SLA urgency"
          value={filters.urgency}
          onChange={(event) =>
            setFilters((current) => ({ ...current, urgency: event.target.value }))
          }
        >
          <option value="">All SLA ages</option>
          <option value="urgent">Urgent (48h+)</option>
          <option value="aging">Aging (24–47h)</option>
          <option value="fresh">Fresh (&lt;24h)</option>
        </select>
        <input
          className="field"
          aria-label="County"
          placeholder="County"
          value={filters.county}
          onChange={(event) =>
            setFilters((current) => ({ ...current, county: event.target.value }))
          }
        />
        <select
          className="field"
          aria-label="Package"
          value={filters.packageTier}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              packageTier: event.target.value,
            }))
          }
        >
          <option value="">All packages</option>
          <option value="vault">Vault</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>
        <select
          className="field"
          aria-label="Review type"
          value={filters.reviewKind}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              reviewKind: event.target.value,
            }))
          }
        >
          <option value="">First + amendments</option>
          <option value="first">First review</option>
          <option value="amendment">Amendment</option>
        </select>
        <button type="submit" className="btn btn-primary">
          Apply filters
        </button>
      </form>
      {loading && <p className="text-lg text-muted">Loading…</p>}

      {!loading && reviews.length === 0 && (
        <p className="rounded-[0.45rem] border-2 border-border bg-surface p-6 text-lg text-muted">
          {t.emptyQueue}
        </p>
      )}

      <QueueSection
        title={t.openCases}
        items={open}
        t={t}
        busyId={busyId}
        onClaim={claim}
        showClaim
      />
      <QueueSection
        title={t.myCases}
        items={mine}
        t={t}
        busyId={busyId}
        onClaim={claim}
        showClaim={false}
      />
      <QueueSection
        title={t.completed}
        items={done}
        t={t}
        busyId={busyId}
        onClaim={claim}
        showClaim={false}
      />
    </div>
  );
}

function QueueSection({
  title,
  items,
  t,
  busyId,
  onClaim,
  showClaim,
}: {
  title: string;
  items: QueueItem[];
  t: ReturnType<typeof advocateCopy>;
  busyId: string | null;
  onClaim: (id: string) => void;
  showClaim: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-forest-deep">{title}</h2>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-[0.45rem] border-2 border-border bg-surface p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xl font-semibold text-ink">{item.ownerName}</p>
                <p className="mt-1 text-base text-muted">
                  {item.ownerPhone} · {t.package}:{" "}
                  <span className="font-semibold capitalize text-forest">
                    {item.packageTier}
                  </span>{" "}
                  · {t.status}:{" "}
                  <span className="font-semibold capitalize">
                    {item.status.replace("_", " ")}
                  </span>
                </p>
                <p className="mt-1 text-base text-muted">
                  {t.consultMode}: {item.consultMode.replace("_", " ")} ·{" "}
                  {new Date(item.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm font-semibold text-forest">
                  {item.isAmendment ? "Amendment" : "First review"} · SLA age{" "}
                  {item.slaAgeHours}h
                  {item.counties.length ? ` · ${item.counties.join(", ")}` : ""}
                </p>
                {item.notes && (
                  <p className="mt-2 text-base text-ink">{item.notes}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {showClaim && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === item.id}
                    onClick={() => onClaim(item.id)}
                  >
                    {busyId === item.id ? "…" : t.assign}
                  </button>
                )}
                <Link
                  href={`/advocate/cases/${item.id}`}
                  className="btn btn-secondary-dark"
                >
                  {t.openCase}
                </Link>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
