"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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
  vault: {
    id: string;
    status: string;
    packageTier: string | null;
    forceLocked?: boolean;
    opsNotes?: string;
  };
  owner: {
    fullName: string;
    phone: string;
    email?: string | null;
    county?: string;
    address?: string;
  } | null;
  assets: Array<{
    id: string;
    title: string;
    type: string;
    titleNumber: string;
    documentName: string | null;
    hasDocument: boolean;
  }>;
  beneficiaries: Array<{ fullName: string; relationship: string; idNumber: string }>;
  reviews: Array<{ id: string; status: string; createdAt: string; packageTier: string }>;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    hasFile: boolean;
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
      <div>
        <h1 className="text-3xl font-semibold">
          {data.owner?.fullName || "Vault"}
        </h1>
        <p className="mt-2 text-[#9aa89c]">
          {data.owner?.phone} · status{" "}
          <span className="capitalize text-[#e8efe9]">
            {data.vault.status.replace("_", " ")}
          </span>
          {data.vault.forceLocked ? (
            <span className="ml-2 text-[#e07a5f]">· FORCE LOCKED</span>
          ) : null}
        </p>
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
        <h2 className="text-xl font-semibold">Submitted documents (view-only)</h2>
        {!reviewId && (
          <p className="mt-2 text-sm text-[#9aa89c]">
            No review case yet — document viewer needs a review id. Structured
            asset data is still below.
          </p>
        )}
        <ul className="mt-4 space-y-3">
          {data.assets.map((a) => (
            <li key={a.id} className="text-sm">
              <span className="font-semibold">{a.title}</span> ({a.type})
              {a.titleNumber ? ` · ${a.titleNumber}` : ""}
              {a.hasDocument && reviewId ? (
                <>
                  {" · "}
                  <a
                    className="text-[#d4a574] underline"
                    href={`/api/secure-docs/view?kind=asset&reviewId=${reviewId}&assetId=${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View {a.documentName || "file"} (view only)
                  </a>
                </>
              ) : a.hasDocument ? (
                <>
                  {" · "}
                  <a
                    className="text-[#d4a574] underline"
                    href={`/api/secure-docs/view?kind=asset&vaultId=${vaultId}&assetId=${a.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View {a.documentName || "file"} (view only)
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Heirs</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.beneficiaries.map((b, i) => (
            <li key={`${b.fullName}-${i}`}>
              {b.fullName} — {b.relationship}
              {b.idNumber ? ` · ID ${b.idNumber}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Legal documents</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.documents.map((d) => (
            <li key={d.id}>
              {d.title} · {d.type} · {d.status}
              {d.hasFile && reviewId ? (
                <>
                  {" · "}
                  <a
                    className="text-[#d4a574] underline"
                    href={`/api/secure-docs/view?kind=legal&reviewId=${reviewId}&documentId=${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View file (view only)
                  </a>
                </>
              ) : null}
            </li>
          ))}
          {data.documents.length === 0 && (
            <li className="text-[#9aa89c]">None yet.</li>
          )}
        </ul>
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
