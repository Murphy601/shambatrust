"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { formatDuration } from "@/lib/audio";

type Approval = {
  role: "trustee" | "guardian";
  trusteeName: string;
  trusteePhone: string;
  status: string;
  approvedAt: string | null;
};

type Detail = {
  case: {
    id: string;
    vaultId: string;
    status: string;
    deathDate: string;
    deathCertificatePath: string | null;
    deathCertificateName: string | null;
    deathNotificationPath: string | null;
    deathNotificationName: string | null;
    filerNotes: string;
    opsNotes: string;
    coolingEndsAt: string | null;
    vaultReleasedAt: string | null;
    releaseNotes: string;
  };
  owner: { fullName: string; phone: string } | null;
  filer: { fullName: string; phone: string } | null;
  approvals: Approval[];
  plan: {
    minTrusteeApprovals: number;
    minGuardianApprovals: number;
    coolingHours: number;
    requireDeathCertificate: boolean;
    requireDeathNotification: boolean;
  } | null;
  beneficiaries: Array<{ fullName: string; relationship: string }>;
  assets: Array<{ title: string; type: string }>;
  testaments: Array<{
    id: string;
    title: string;
    languageLabel: string;
    durationSeconds: number | null;
    transcript: string;
    transcriptStatus: string;
  }>;
  /** Release rules evaluated on the server; the UI only renders them. */
  gates: {
    trusteeApproved: number;
    trusteeRequired: number;
    guardianApproved: number;
    guardianRequired: number;
    opsVerified: boolean;
    coolingActive: boolean;
    coolingEndsAt: string | null;
    released: boolean;
    blockers: string[];
    canRelease: boolean;
  } | null;
};

export default function OpsSuccessionDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opsNotes, setOpsNotes] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
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
    setReleaseNotes(json.case.releaseNotes || "");
  }, [id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function post(body: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/ops/succession/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setMessage(successMessage);
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
  const trustees = data.approvals.filter((a) => a.role === "trustee");
  const guardians = data.approvals.filter((a) => a.role === "guardian");
  const gates = data.gates;
  const blockers = gates?.blockers ?? [];

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
        <h2 className="text-xl font-semibold">Death proofs</h2>
        <div className="mt-3 space-y-2 text-sm">
          <p>
            <span className="font-semibold">Official notification:</span>{" "}
            {data.case.deathNotificationPath ? (
              <a
                className="text-[#d4a574] underline"
                href={`/api/secure-docs/view?kind=death_notification&caseId=${data.case.id}`}
                target="_blank"
                rel="noreferrer"
              >
                View {data.case.deathNotificationName || "notification"} (view only)
              </a>
            ) : (
              <span className="text-[#9aa89c]">
                Not uploaded
                {data.plan?.requireDeathNotification ? " — required by this vault" : ""}
              </span>
            )}
          </p>
          <p>
            <span className="font-semibold">Death certificate:</span>{" "}
            {data.case.deathCertificatePath ? (
              <a
                className="text-[#d4a574] underline"
                href={`/api/secure-docs/view?kind=death_cert&caseId=${data.case.id}`}
                target="_blank"
                rel="noreferrer"
              >
                View {data.case.deathCertificateName || "certificate"} (view only)
              </a>
            ) : (
              <span className="text-[#9aa89c]">
                Not uploaded
                {data.plan?.requireDeathCertificate ? " — required by this vault" : ""}
              </span>
            )}
          </p>
        </div>
        {data.case.filerNotes && (
          <p className="mt-3 text-sm">Filer notes: {data.case.filerNotes}</p>
        )}
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">
          Trustee approvals ({gates?.trusteeApproved ?? 0}/
          {gates?.trusteeRequired ?? 0})
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {trustees.map((a) => (
            <li key={`${a.role}-${a.trusteePhone}`}>
              {a.trusteeName} ({a.trusteePhone}) —{" "}
              <span className="capitalize">{a.status}</span>
              {a.approvedAt ? ` · ${new Date(a.approvedAt).toLocaleString()}` : ""}
            </li>
          ))}
          {trustees.length === 0 && (
            <li className="text-[#9aa89c]">No trustees on this claim.</li>
          )}
        </ul>

        <h2 className="mt-5 text-xl font-semibold">
          Guardian confirmations ({gates?.guardianApproved ?? 0}/
          {gates?.guardianRequired ?? 0})
        </h2>
        <p className="mt-1 text-sm text-[#9aa89c]">
          Two different people must confirm; the same account cannot satisfy both
          slots.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {guardians.map((a) => (
            <li key={`${a.role}-${a.trusteePhone}`}>
              {a.trusteeName} ({a.trusteePhone}) —{" "}
              <span className="capitalize">{a.status}</span>
              {a.approvedAt ? ` · ${new Date(a.approvedAt).toLocaleString()}` : ""}
            </li>
          ))}
          {guardians.length === 0 && (
            <li className="text-[#9aa89c]">
              No guardians named on this vault&apos;s execution plan.
            </li>
          )}
        </ul>
        <p className="mt-3 text-sm text-[#9aa89c]">
          Cooling after verification: {data.plan?.coolingHours ?? 48}h
        </p>
      </section>

      {data.testaments.length > 0 && (
        <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
          <h2 className="text-xl font-semibold">Voice testaments</h2>
          <ul className="mt-3 space-y-4">
            {data.testaments.map((t) => (
              <li key={t.id} className="text-sm">
                <p className="font-semibold">
                  {t.title}{" "}
                  <span className="font-normal text-[#9aa89c]">
                    · {t.languageLabel} · {formatDuration(t.durationSeconds)} ·{" "}
                    {t.transcriptStatus.replace(/_/g, " ")}
                  </span>
                </p>
                <audio
                  className="mt-2 w-full"
                  controls
                  preload="none"
                  src={`/api/vault/testaments/${t.id}/audio`}
                />
                {t.transcript && (
                  <p className="mt-2 whitespace-pre-wrap text-[#e8efe9]">
                    {t.transcript}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

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
              onClick={() =>
                void post(
                  { decision: "approve", opsNotes },
                  "Verified. Cooling period started.",
                )
              }
              className="rounded bg-[#2f5d45] px-4 py-2 font-semibold text-white"
            >
              Verify &amp; release to advocates
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void post({ decision: "reject", opsNotes }, "Claim rejected.")
              }
              className="rounded border border-[#e07a5f] px-4 py-2 font-semibold text-[#e07a5f]"
            >
              Reject claim
            </button>
          </div>
        </section>
      )}

      <section className="rounded border border-[#d4a574]/40 bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Vault release to executors</h2>
        <p className="mt-2 text-sm text-[#9aa89c]">
          The final gate. Once released, confirmed trustees, confirmed guardians
          and named heirs can open the sealed dossier. This cannot be undone.
        </p>

        {gates?.released ? (
          <p className="mt-3 text-sm text-[#d4a574]">
            Released{" "}
            {data.case.vaultReleasedAt
              ? new Date(data.case.vaultReleasedAt).toLocaleString()
              : ""}
            {data.case.releaseNotes ? ` — ${data.case.releaseNotes}` : ""}
          </p>
        ) : (
          <>
            {blockers.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-[#e07a5f]">
                {blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            )}
            <textarea
              className="mt-3 w-full rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-3 text-base"
              rows={2}
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              placeholder="Who was notified, and how"
            />
            <button
              type="button"
              disabled={busy || !gates?.canRelease}
              onClick={() =>
                void post(
                  { action: "release_vault", releaseNotes },
                  "Vault access released to executors.",
                )
              }
              className="mt-4 rounded bg-[#2f5d45] px-4 py-2 font-semibold text-white disabled:opacity-50"
            >
              Release vault access
            </button>
          </>
        )}
      </section>
    </div>
  );
}
