"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";

type Detail = {
  case: {
    id: string;
    status: string;
    deathDate: string;
    deathCertificatePath: string | null;
    coolingEndsAt: string | null;
    advocateId: string | null;
  };
  owner: { fullName: string; phone: string } | null;
  beneficiaries: Array<{ fullName: string; relationship: string }>;
  assets: Array<{ title: string; type: string; titleNumber: string }>;
  documents: Array<{ title: string; type: string; status: string }>;
  approvals: Array<{
    trusteeName: string;
    trusteePhone: string;
    status: string;
    approvedAt: string | null;
  }>;
  plan: { minTrusteeApprovals: number } | null;
};

export default function AdvocateSuccessionCasePage() {
  const params = useParams();
  const id = String(params.id || "");
  const { locale } = useLocale();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState({
    deathCertReviewed: false,
    trusteesConfirmed: false,
    probateFiled: false,
    transfersStarted: false,
    familyNotified: false,
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/advocate/succession/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setData(json);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/succession/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not claim");
      setMessage(locale === "sw" ? "Umechukua kesi." : "Case claimed.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/succession/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not complete");
      setMessage(
        locale === "sw" ? "Mirathi imekamilika." : "Succession marked complete.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data && error) return <p className="text-[var(--danger)]">{error}</p>;
  if (!data) return <p className="text-muted">Loading…</p>;

  const coolingActive =
    data.case.status === "succession_verified" &&
    data.case.coolingEndsAt &&
    new Date(data.case.coolingEndsAt).getTime() > Date.now();

  return (
    <div className="space-y-6">
      <Link
        href="/advocate/succession"
        className="text-base font-semibold text-forest underline"
      >
        ← {locale === "sw" ? "Rudi foleni" : "Back to queue"}
      </Link>
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {data.owner?.fullName || "Succession"}
        </h1>
        <p className="mt-2 text-lg text-muted capitalize">
          {data.case.status.replace(/_/g, " ")} · death {data.case.deathDate}
        </p>
      </div>

      {error && <p className="text-[var(--danger)]">{error}</p>}
      {message && <p className="font-semibold text-forest">{message}</p>}

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5">
        <h2 className="text-xl font-semibold text-forest-deep">
          Trustee OTP status
        </h2>
        <p className="mt-1 text-sm text-muted">
          Required: {data.plan?.minTrusteeApprovals ?? "—"}
        </p>
        <ul className="mt-3 space-y-2 text-base">
          {(data.approvals || []).map((a) => (
            <li key={a.trusteePhone}>
              {a.trusteeName} ({a.trusteePhone}) —{" "}
              <span className="capitalize font-semibold">{a.status}</span>
              {a.approvedAt
                ? ` · ${new Date(a.approvedAt).toLocaleString()}`
                : ""}
            </li>
          ))}
          {(data.approvals || []).length === 0 && (
            <li className="text-muted">No trustees on this claim.</li>
          )}
        </ul>
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5">
        <h2 className="text-xl font-semibold text-forest-deep">
          Transfer checklist
        </h2>
        <ul className="mt-3 space-y-2">
          {(
            [
              ["deathCertReviewed", "Death certificate reviewed"],
              ["trusteesConfirmed", "Trustee OTPs confirmed"],
              ["probateFiled", "Probate / petition filed"],
              ["transfersStarted", "Title / account transfers started"],
              ["familyNotified", "Family notified of progress"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-3 text-base">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={checklist[key]}
                onChange={(e) =>
                  setChecklist((c) => ({ ...c, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </ul>
      </section>

      {data.case.deathCertificatePath && (
        <a
          className="inline-block font-semibold text-forest underline"
          href={`/api/secure-docs/view?kind=death_cert&caseId=${data.case.id}`}
          target="_blank"
          rel="noreferrer"
        >
          {locale === "sw"
            ? "Angalia cheti cha kifo (baada ya kuchukua)"
            : "View death certificate (after claim)"}
        </a>
      )}

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5">
        <h2 className="text-xl font-semibold text-forest-deep">
          {locale === "sw" ? "Mpango uliofungwa" : "Sealed plan"}
        </h2>
        <h3 className="mt-4 font-semibold">Heirs</h3>
        <ul className="mt-2 space-y-1 text-base">
          {data.beneficiaries.map((b) => (
            <li key={b.fullName}>
              {b.fullName} — {b.relationship}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 font-semibold">Assets</h3>
        <ul className="mt-2 space-y-1 text-base">
          {data.assets.map((a) => (
            <li key={a.title}>
              {a.title} ({a.type})
              {a.titleNumber ? ` · ${a.titleNumber}` : ""}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 font-semibold">Legal docs</h3>
        <ul className="mt-2 space-y-1 text-base">
          {data.documents.map((d) => (
            <li key={d.title}>
              {d.title} · {d.type} · {d.status}
            </li>
          ))}
        </ul>
      </section>

      {data.case.status === "succession_verified" && (
        <div className="space-y-3">
          {coolingActive ? (
            <p className="text-brass">
              Cooling until{" "}
              {new Date(data.case.coolingEndsAt!).toLocaleString()}
            </p>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={claim}
            >
              {locale === "sw" ? "Chukua kesi" : "Claim succession case"}
            </button>
          )}
        </div>
      )}

      {data.case.status === "with_advocate" && (
        <div className="space-y-3 rounded-[0.45rem] border-2 border-border bg-surface p-5">
          <label className="field-label">
            {locale === "sw" ? "Maelezo ya kukamilisha" : "Completion notes"}
          </label>
          <textarea
            className="field min-h-24"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Probate filed / transfers in progress…"
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={complete}
          >
            {locale === "sw" ? "Weka kama imekamilika" : "Mark succession complete"}
          </button>
        </div>
      )}
    </div>
  );
}
