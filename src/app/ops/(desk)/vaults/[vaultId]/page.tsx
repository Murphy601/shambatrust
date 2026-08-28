"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/audio";
import { nomineeTotal, parcelIdentifiers } from "@/lib/asset-fields";
import type {
  Allocation,
  Asset,
  Beneficiary,
  ExecutionPlan,
  LegalDocument,
  ReviewRequest,
  TitleLookupRecord,
  Vault,
} from "@/lib/db/types";

type BinderRow = {
  id: string;
  version: number;
  status: string;
  documentName: string;
  pageCount: number | null;
  fileHash: string | null;
  error: string | null;
  advocateName: string;
  sealedAt: string;
  createdAt: string;
  completedAt: string | null;
  hasFile: boolean;
};

type VaultDetail = {
  vault: Vault;
  owner: {
    fullName: string;
    phone: string;
    email?: string | null;
    county?: string;
    address?: string;
    preferredLanguage?: string;
    idOnFile?: boolean;
    idFrontName?: string | null;
    idBackName?: string | null;
  } | null;
  assets: Array<Asset & { hasDocument: boolean }>;
  beneficiaries: Beneficiary[];
  allocations: Allocation[];
  reviews: ReviewRequest[];
  documents: Array<LegalDocument & { hasFile: boolean }>;
  lookups: TitleLookupRecord[];
  executionPlan: ExecutionPlan | null;
  testaments: Array<{
    id: string;
    title: string;
    languageLabel: string;
    durationSeconds: number | null;
    transcript: string;
    transcriptStatus: string;
    recordedByAgent: boolean;
    assetId: string | null;
    createdAt: string;
  }>;
  binders: BinderRow[];
  latestBinder: BinderRow | null;
  audit: Array<{ id: string; action: string; detail: string; createdAt: string }>;
  viewReviewId: string | null;
};

export default function OpsVaultPage() {
  const params = useParams();
  const vaultId = String(params.vaultId || "");
  const [data, setData] = useState<VaultDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opsNotes, setOpsNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/ops/vaults/${vaultId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setData(json);
    setOpsNotes(json.vault?.opsNotes || "");
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultId]);

  async function saveControls(body: Record<string, unknown>) {
    setMessage(null);
    setError(null);
    const res = await fetch(`/api/ops/vaults/${vaultId}/controls`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    if (json.supportUrl) {
      window.location.href = json.supportUrl;
      return;
    }
    setMessage("Saved.");
    await refresh();
  }

  async function regenerateBinder(binderId: string) {
    setRegenLoading(binderId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/ops/binders/${binderId}/regenerate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Regenerate failed");
      setMessage("Binder regenerated.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regenerate failed");
    } finally {
      setRegenLoading(null);
    }
  }

  if (error && !data) return <p className="text-[#e07a5f]">{error}</p>;
  if (!data) return <p className="text-[#9aa89c]">Loading vault…</p>;

  const reviewId = data.viewReviewId;
  const latest = data.latestBinder;

  return (
    <div className="space-y-6">
      <Link href="/ops/elders" className="text-sm text-[#d4a574] underline">
        ← Elders
      </Link>
      {" · "}
      <Link href="/ops/documents" className="text-sm text-[#d4a574] underline">
        Documents / Master Dossiers
      </Link>
      <div>
        <h1 className="text-3xl font-semibold">
          {data.owner?.fullName || "Vault"}
        </h1>
        <p className="mt-2 text-[#9aa89c]">
          {data.owner?.phone}
          {data.owner?.email ? ` · ${data.owner.email}` : ""}
          {data.owner?.county ? ` · ${data.owner.county}` : ""}
          {" · status "}
          <span className="capitalize text-[#e8efe9]">
            {data.vault.status.replace("_", " ")}
          </span>
          {data.vault.packageTier ? ` · ${data.vault.packageTier}` : ""}
          {data.vault.forceLocked ? (
            <span className="ml-2 text-[#e07a5f]">· FORCE LOCKED</span>
          ) : null}
        </p>
        {data.owner?.address ? (
          <p className="mt-1 text-sm text-[#9aa89c]">{data.owner.address}</p>
        ) : null}
      </div>

      {message && <p className="text-[#d4a574]">{message}</p>}
      {error && <p className="text-[#e07a5f]">{error}</p>}

      <section className="rounded border border-[#d4a574]/50 bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold text-[#d4a574]">Sealed Vault Binder</h2>
        <p className="mt-2 text-sm text-[#9aa89c]">
          Auto-built when the advocate seals the vault — elder identity, assets,
          heirs, allocations, instruments, and seal attestation in one PDF.
          Each re-seal creates a new version.
        </p>
        {!latest ? (
          <p className="mt-4 text-sm text-[#9aa89c]">
            No binder yet. It appears after the advocate seals and signs.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded border border-[#3d4a40] bg-[#0f1411] p-4 text-sm">
              <p className="font-semibold text-[#e8efe9]">
                Latest · v{latest.version} ·{" "}
                <span className="capitalize">{latest.status}</span>
              </p>
              <p className="mt-1 text-[#9aa89c]">
                Sealed {new Date(latest.sealedAt).toLocaleString()} · Advocate{" "}
                {latest.advocateName}
                {latest.pageCount != null ? ` · ${latest.pageCount} pages` : ""}
              </p>
              {latest.fileHash && (
                <p className="mt-1 font-mono text-xs text-[#7a8a7e]">
                  sha256 {latest.fileHash.slice(0, 24)}…
                </p>
              )}
              {latest.error && (
                <p className="mt-2 text-[#e07a5f]">{latest.error}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {latest.hasFile && (
                  <a
                    className="rounded bg-[#2f5d45] px-3 py-2 text-sm font-semibold text-white"
                    href={`/api/ops/binders/${latest.id}/download`}
                  >
                    Download PDF
                  </a>
                )}
                {latest.status === "failed" && (
                  <button
                    type="button"
                    className="rounded border border-[#d4a574] px-3 py-2 text-sm font-semibold text-[#d4a574]"
                    disabled={regenLoading === latest.id}
                    onClick={() => void regenerateBinder(latest.id)}
                  >
                    {regenLoading === latest.id ? "Retrying…" : "Retry generation"}
                  </button>
                )}
                {latest.status === "generating" && (
                  <button
                    type="button"
                    className="rounded border border-[#3d4a40] px-3 py-2 text-sm text-[#9aa89c]"
                    onClick={() => void refresh()}
                  >
                    Refresh status
                  </button>
                )}
              </div>
            </div>
            {data.binders.length > 1 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9aa89c]">
                  Version history
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {data.binders.map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3d4a40] py-2"
                    >
                      <span>
                        v{b.version} · {b.status}
                        {b.pageCount != null ? ` · ${b.pageCount}p` : ""}
                      </span>
                      <span className="flex gap-2">
                        {b.hasFile && (
                          <a
                            className="text-[#d4a574] underline"
                            href={`/api/ops/binders/${b.id}/download`}
                          >
                            Download
                          </a>
                        )}
                        {b.status === "failed" && (
                          <button
                            type="button"
                            className="text-[#d4a574] underline"
                            disabled={regenLoading === b.id}
                            onClick={() => void regenerateBinder(b.id)}
                          >
                            Retry
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Ops controls</h2>
        <textarea
          className="mt-3 w-full rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-2 text-sm"
          rows={3}
          placeholder="Internal ops notes…"
          value={opsNotes}
          onChange={(e) => setOpsNotes(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-[#2f5d45] px-3 py-2 text-sm font-semibold text-white"
            onClick={() => void saveControls({ opsNotes })}
          >
            Save notes
          </button>
          <button
            type="button"
            className="rounded border border-[#e07a5f] px-3 py-2 text-sm font-semibold text-[#e07a5f]"
            onClick={() =>
              void saveControls({
                forceLocked: !data.vault.forceLocked,
                opsNotes,
              })
            }
          >
            {data.vault.forceLocked ? "Clear force-lock" : "Force-lock edits"}
          </button>
          <button
            type="button"
            className="rounded border border-[#d4a574] px-3 py-2 text-sm font-semibold text-[#d4a574]"
            onClick={() =>
              void saveControls({
                startSupport: true,
                supportNote: "Read-only support view",
              })
            }
          >
            Start support mode
          </button>
        </div>
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">1. Elder identity &amp; KYC</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[#9aa89c]">Spoken language</dt>
            <dd>{data.owner?.preferredLanguage || "—"}</dd>
          </div>
          <div>
            <dt className="text-[#9aa89c]">National ID</dt>
            <dd>
              {data.owner?.idOnFile ? "On file" : "Missing"}
              {data.owner?.idFrontName ? ` · ${data.owner.idFrontName}` : ""}
            </dd>
          </div>
        </dl>
        {data.owner?.idOnFile && (
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="text-[#d4a574] underline"
              href={`/api/ops/documents/file?elderId=${data.vault.ownerId}&slot=idFront&disposition=inline`}
              target="_blank"
              rel="noreferrer"
            >
              View ID front
            </a>
            <a
              className="text-[#d4a574] underline"
              href={`/api/ops/documents/file?elderId=${data.vault.ownerId}&slot=idBack&disposition=inline`}
              target="_blank"
              rel="noreferrer"
            >
              View ID back
            </a>
          </div>
        )}
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">2. Assets register</h2>
        <ul className="mt-4 space-y-4">
          {data.assets.length === 0 && (
            <li className="text-sm text-[#9aa89c]">No assets listed.</li>
          )}
          {data.assets.map((a) => (
            <li key={a.id} className="border-l-2 border-[#d4a574] pl-3 text-sm">
              <p className="font-semibold">
                {a.title}{" "}
                <span className="capitalize text-[#9aa89c]">
                  ({a.type.replace(/_/g, " ")})
                </span>
              </p>
              {a.county ? (
                <p className="text-[#9aa89c]">
                  {a.county}
                  {a.subCounty ? ` · ${a.subCounty}` : ""}
                  {a.landmark ? ` · ${a.landmark}` : ""}
                </p>
              ) : null}
              {parcelIdentifiers(a).length > 0 && (
                <dl className="mt-1 grid gap-x-4 sm:grid-cols-2">
                  {parcelIdentifiers(a).map((row) => (
                    <div key={row.label} className="flex gap-2">
                      <dt className="text-[#9aa89c]">{row.label}:</dt>
                      <dd className="font-semibold">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {a.gpsLat != null && a.gpsLng != null && (
                <p className="mt-1">
                  <a
                    className="text-[#d4a574] underline"
                    href={`https://www.google.com/maps?q=${a.gpsLat},${a.gpsLng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    GPS pin {a.gpsLat}, {a.gpsLng}
                  </a>
                </p>
              )}
              {(a.disputeFlag || a.familyAlert) && (
                <p className="mt-1 font-semibold text-[#e07a5f]">
                  {a.disputeFlag ? "Dispute / caveat" : "Family alert"}
                  {a.disputeNotes ? ` — ${a.disputeNotes}` : ""}
                </p>
              )}
              {a.type === "sacco" && (
                <div className="mt-1">
                  {a.saccoName ? (
                    <p className="text-[#9aa89c]">
                      SACCO: {a.saccoName}
                      {a.saccoMemberNumber ? ` · member ${a.saccoMemberNumber}` : ""}
                      {a.mpesaNumber ? ` · M-Pesa ${a.mpesaNumber}` : ""}
                    </p>
                  ) : null}
                  {a.saccoNominees.length > 0 && (
                    <>
                      <p className="mt-1 font-semibold">
                        Nominees ({nomineeTotal(a.saccoNominees)}%) — paid outside
                        the estate
                      </p>
                      <ul className="mt-0.5 pl-4 text-[#9aa89c]">
                        {a.saccoNominees.map((nominee) => (
                          <li key={nominee.id}>
                            {nominee.fullName}
                            {nominee.relationship
                              ? ` — ${nominee.relationship}`
                              : ""}{" "}
                            · {nominee.percentage}%
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              {a.notes ? <p className="mt-1 text-[#9aa89c]">{a.notes}</p> : null}
              {a.hasDocument ? (
                <p className="mt-1">
                  <a
                    className="text-[#d4a574] underline"
                    href={
                      reviewId
                        ? `/api/secure-docs/view?kind=asset&reviewId=${reviewId}&assetId=${a.id}`
                        : `/api/secure-docs/view?kind=asset&vaultId=${vaultId}&assetId=${a.id}`
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    View {a.documentName || "file"}
                  </a>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">3. Heirs &amp; allocations</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {data.beneficiaries.map((b) => {
            const shares = data.allocations.filter(
              (allocation) => allocation.beneficiaryId === b.id,
            );
            return (
              <li key={b.id}>
                <span className="font-semibold">{b.fullName}</span> —{" "}
                {b.relationship}
                {b.idNumber ? ` · ID ${b.idNumber}` : ""}
                {b.phone ? ` · ${b.phone}` : ""}
                {shares.length > 0 && (
                  <ul className="mt-1 pl-4 text-[#9aa89c]">
                    {shares.map((share) => {
                      const asset = data.assets.find((a) => a.id === share.assetId);
                      return (
                        <li key={share.id}>
                          {asset?.title || share.specificGift || "Estate"}
                          {share.percentage != null ? ` — ${share.percentage}%` : ""}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
          {data.beneficiaries.length === 0 && (
            <li className="text-[#9aa89c]">No heirs named.</li>
          )}
        </ul>
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">4. Will, trust &amp; burial drafts</h2>
        <div className="mt-3 grid gap-4 text-sm lg:grid-cols-3">
          <div>
            <p className="font-semibold text-[#d4a574]">Will builder</p>
            {data.vault.willDraft ? (
              <ul className="mt-2 space-y-1 text-[#e8efe9]">
                <li>Testator: {data.vault.willDraft.testatorName || "—"}</li>
                <li>Executor: {data.vault.willDraft.executorName || "—"}</li>
                <li>Guardian: {data.vault.willDraft.guardianName || "—"}</li>
                <li>
                  Witnesses:{" "}
                  {data.vault.willDraft.witnessAcknowledged
                    ? "Section 11 acknowledged"
                    : "Not yet acknowledged"}
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-[#9aa89c]">No will draft yet.</p>
            )}
          </div>
          <div>
            <p className="font-semibold text-[#d4a574]">Family land trust</p>
            {data.vault.trustDraft ? (
              <ul className="mt-2 space-y-1 text-[#e8efe9]">
                <li>{data.vault.trustDraft.trustName || "Unnamed trust"}</li>
                <li>Trustee: {data.vault.trustDraft.primaryTrustee || "—"}</li>
                <li>Co-trustee: {data.vault.trustDraft.coTrustee || "—"}</li>
                {data.vault.trustDraft.titleNumbers ? (
                  <li className="whitespace-pre-wrap">
                    LR: {data.vault.trustDraft.titleNumbers}
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-2 text-[#9aa89c]">No trust draft yet.</p>
            )}
          </div>
          <div>
            <p className="font-semibold text-[#d4a574]">Burial wishes</p>
            {data.vault.burialWishes ? (
              <ul className="mt-2 space-y-1 text-[#e8efe9]">
                <li className="capitalize">
                  {data.vault.burialWishes.burialLocation}
                </li>
                {data.vault.burialWishes.burialDetails ? (
                  <li>{data.vault.burialWishes.burialDetails}</li>
                ) : null}
                <li>
                  Committee: {data.vault.burialWishes.committeeLead1 || "—"}
                  {data.vault.burialWishes.committeeLead2
                    ? ` / ${data.vault.burialWishes.committeeLead2}`
                    : ""}
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-[#9aa89c]">No burial wishes yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">5. Execution plan</h2>
        {!data.executionPlan ? (
          <p className="mt-3 text-sm text-[#9aa89c]">No execution plan on file.</p>
        ) : (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Trigger {data.executionPlan.triggerType.replace(/_/g, " ")} · min{" "}
              {data.executionPlan.minTrusteeApprovals} trustee
              {data.executionPlan.minGuardianApprovals
                ? ` · min ${data.executionPlan.minGuardianApprovals} guardian`
                : ""}{" "}
              · cooling {data.executionPlan.coolingHours}h
            </p>
            <p>
              Death certificate:{" "}
              {data.executionPlan.requireDeathCertificate ? "required" : "optional"}
              {" · "}
              Death notification:{" "}
              {data.executionPlan.requireDeathNotification ? "required" : "optional"}
            </p>
            <div>
              <p className="font-semibold">Trustees</p>
              <ul className="mt-1 text-[#9aa89c]">
                {(data.executionPlan.trustees || []).map((t) => (
                  <li key={`${t.fullName}-${t.phone}`}>
                    {t.fullName} · {t.phone || "—"}
                    {t.idNumber ? ` · ID ${t.idNumber}` : ""}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold">Guardians (dual verification)</p>
              <ul className="mt-1 text-[#9aa89c]">
                {(data.executionPlan.guardians || []).length === 0 && (
                  <li>None named.</li>
                )}
                {(data.executionPlan.guardians || []).map((g) => (
                  <li key={`${g.fullName}-${g.phone}`}>
                    {g.fullName} · {g.phone || "—"}
                    {g.relationship ? ` · ${g.relationship}` : ""}
                    {g.idNumber ? ` · ID ${g.idNumber}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">6. Advocate instruments</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.documents.map((d) => (
            <li key={d.id}>
              <span className="font-semibold">{d.title}</span>
              {" · "}
              <span className="capitalize">{d.type.replace(/_/g, " ")}</span>
              {" · "}
              {d.status.replace(/_/g, " ")}
              {d.stampRef ? ` · stamp ${d.stampRef}` : ""}
              {d.signatureName ? ` · signed ${d.signatureName}` : ""}
              {d.hasFile && reviewId ? (
                <>
                  {" · "}
                  <a
                    className="text-[#d4a574] underline"
                    href={`/api/secure-docs/view?kind=legal&reviewId=${reviewId}&documentId=${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View file
                  </a>
                </>
              ) : null}
            </li>
          ))}
          {data.documents.length === 0 && (
            <li className="text-[#9aa89c]">None yet.</li>
          )}
        </ul>
        {data.reviews[0] && (
          <p className="mt-3 text-sm text-[#9aa89c]">
            Latest review {data.reviews[0].packageTier} · {data.reviews[0].status}
            {data.reviews[0].notes ? ` — ${data.reviews[0].notes}` : ""}
          </p>
        )}
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">7. Title lookups</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.lookups.map((lookup) => (
            <li key={lookup.id}>
              {lookup.titleNumber}
              {lookup.result
                ? ` · ${lookup.result.found ? "Found" : "Not found"} · ${lookup.result.registrationStatus}`
                : " · pending"}
              {lookup.result?.ownerName
                ? ` · registry owner ${lookup.result.ownerName}`
                : ""}
            </li>
          ))}
          {data.lookups.length === 0 && (
            <li className="text-[#9aa89c]">No title lookups recorded.</li>
          )}
        </ul>
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">8. Voice testaments</h2>
        {data.testaments.length === 0 ? (
          <p className="mt-3 text-sm text-[#9aa89c]">No spoken statements recorded.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {data.testaments.map((testament) => (
              <li
                key={testament.id}
                className="rounded border border-[#3d4a40] bg-[#0f1411] p-4 text-sm"
              >
                <p className="font-semibold">{testament.title}</p>
                <p className="text-[#9aa89c]">
                  {testament.languageLabel} ·{" "}
                  {formatDuration(testament.durationSeconds)} ·{" "}
                  {testament.transcriptStatus.replace(/_/g, " ")}
                  {testament.recordedByAgent ? " · captured by family agent" : ""}
                </p>
                <audio
                  className="mt-3 w-full"
                  controls
                  preload="none"
                  src={`/api/vault/testaments/${testament.id}/audio`}
                />
                {testament.transcript ? (
                  <p className="mt-3 whitespace-pre-wrap">{testament.transcript}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Vault activity</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.audit.slice(0, 20).map((row) => (
            <li key={row.id}>
              <span className="font-semibold">
                {row.action.replace(/_/g, " ")}
              </span>{" "}
              — {row.detail}
              <div className="text-[#9aa89c]">
                {new Date(row.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
