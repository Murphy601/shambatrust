"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Detail = {
  case: {
    id: string;
    vaultId: string;
    status: string;
    deathDate: string;
    deathCertificatePath: string | null;
    deathCertificateName: string | null;
    filerNotes: string;
    opsNotes: string;
    coolingEndsAt: string | null;
  };
  owner: { fullName: string; phone: string } | null;
  filer: { fullName: string; phone: string } | null;
  approvals: Array<{
    trusteeName: string;
    trusteePhone: string;
    status: string;
  }>;
  plan: { minTrusteeApprovals: number; coolingHours: number } | null;
  beneficiaries: Array<{ fullName: string; relationship: string }>;
  assets: Array<{ title: string; type: string }>;
};

export default function OpsSuccessionDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opsNotes, setOpsNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ops/succession/${id}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setData(json);
    setOpsNotes(json.case.opsNotes || "");
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/ops/succession/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, opsNotes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setMessage(decision === "approve" ? "Verified." : "Rejected.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <p className="text-[#e07a5f]">{error}</p>;
  if (!data) return <p className="text-[#9aa89c]">Loading…</p>;

  const pendingOps = data.case.status === "pending_ops_verification";

  return (
    <div className="space-y-6">
      <Link href="/ops/succession" className="text-sm text-[#d4a574] underline">
        ← Succession queue
      </Link>
      <div>
        <h1 className="text-3xl font-semibold">
          {data.owner?.fullName || "Succession case"}
        </h1>
        <p className="mt-2 text-[#9aa89c]">
          Status:{" "}
          <span className="capitalize text-[#e8efe9]">
            {data.case.status.replace(/_/g, " ")}
          </span>{" "}
          · Death {data.case.deathDate}
        </p>
        <p className="mt-1 text-sm text-[#9aa89c]">
          Filed by {data.filer?.fullName} ({data.filer?.phone})
        </p>
      </div>

      {error && <p className="text-[#e07a5f]">{error}</p>}
      {message && <p className="text-[#d4a574]">{message}</p>}

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Death certificate</h2>
        {data.case.deathCertificatePath ? (
          <a
            className="mt-3 inline-block text-[#d4a574] underline"
            href={`/api/secure-docs/view?kind=death_cert&caseId=${data.case.id}`}
            target="_blank"
            rel="noreferrer"
          >
            View {data.case.deathCertificateName || "certificate"} (view only)
          </a>
        ) : (
          <p className="mt-2 text-[#9aa89c]">No file uploaded.</p>
        )}
        {data.case.filerNotes && (
          <p className="mt-3 text-sm">Notes: {data.case.filerNotes}</p>
        )}
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Trustee approvals</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.approvals.map((a) => (
            <li key={a.trusteePhone}>
              {a.trusteeName} ({a.trusteePhone}) —{" "}
              <span className="capitalize">{a.status}</span>
            </li>
          ))}
          {data.approvals.length === 0 && (
            <li className="text-[#9aa89c]">No trustees (goes to ops directly).</li>
          )}
        </ul>
        <p className="mt-2 text-sm text-[#9aa89c]">
          Required: {data.plan?.minTrusteeApprovals ?? "—"} · Cooling after
          approve: {data.plan?.coolingHours ?? 48}h
        </p>
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Sealed plan snapshot</h2>
        <p className="mt-2 text-sm text-[#9aa89c]">
          Assets: {data.assets.length} · Heirs: {data.beneficiaries.length}
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {data.beneficiaries.map((b) => (
            <li key={b.fullName}>
              {b.fullName} — {b.relationship}
            </li>
          ))}
        </ul>
      </section>

      {pendingOps && (
        <section className="rounded border border-[#d4a574]/40 bg-[#121a16] p-5">
          <h2 className="text-xl font-semibold">Ops decision</h2>
          <textarea
            className="mt-3 w-full rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-3 text-base"
            rows={3}
            value={opsNotes}
            onChange={(e) => setOpsNotes(e.target.value)}
            placeholder="Verification notes"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("approve")}
              className="rounded bg-[#2f5d45] px-4 py-2 font-semibold text-white"
            >
              Verify & release to advocates
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("reject")}
              className="rounded border border-[#e07a5f] px-4 py-2 font-semibold text-[#e07a5f]"
            >
              Reject claim
            </button>
          </div>
        </section>
      )}

      {data.case.coolingEndsAt && data.case.status === "succession_verified" && (
        <p className="text-sm text-[#d4a574]">
          Cooling until {new Date(data.case.coolingEndsAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
