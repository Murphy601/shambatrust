"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { OpsDossierRow, OpsFileRow } from "@/lib/ops/document-index";

type Tab = "vault" | "dossiers";

export default function OpsDocumentsPage() {
  const [tab, setTab] = useState<Tab>("vault");
  const [q, setQ] = useState("");
  const [files, setFiles] = useState<OpsFileRow[]>([]);
  const [dossiers, setDossiers] = useState<OpsDossierRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    const res = await fetch(`/api/ops/documents?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load documents");
      return;
    }
    setFiles(json.files || []);
    setDossiers(json.dossiers || []);
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Documents</h1>
        <p className="mt-2 text-[#9aa89c]">
          Document Vault is every file. Master Dossiers open the same enriched
          case record used after seal — identity, GPS, heirs, allocations, will /
          trust / burial drafts, voice transcripts, and the printable binder.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded px-4 py-2 text-sm font-semibold ${
            tab === "vault"
              ? "bg-[#2f5d45] text-white"
              : "border border-[#3d4a40]"
          }`}
          onClick={() => setTab("vault")}
        >
          Document Vault
        </button>
        <button
          type="button"
          className={`rounded px-4 py-2 text-sm font-semibold ${
            tab === "dossiers"
              ? "bg-[#2f5d45] text-white"
              : "border border-[#3d4a40]"
          }`}
          onClick={() => setTab("dossiers")}
        >
          Master Dossiers
        </button>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void load(q);
        }}
      >
        <input
          className="min-w-[16rem] flex-1 rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-2"
          placeholder="Search elder, phone, LR / title, KRA, heir…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="submit"
          className="rounded bg-[#2f5d45] px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </form>

      {error && <p className="text-[#e07a5f]">{error}</p>}

      {tab === "vault" ? (
        <div className="overflow-x-auto rounded border border-[#3d4a40] bg-[#121a16]">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b border-[#3d4a40] text-[#9aa89c]">
              <tr>
                <th className="px-4 py-3 font-semibold">Elder</th>
                <th className="px-4 py-3 font-semibold">Document</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-[#9aa89c]">
                    No files yet.
                  </td>
                </tr>
              )}
              {files.map((file) => (
                <tr key={file.key} className="border-t border-[#3d4a40]">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{file.elderName}</p>
                    <p className="text-[#9aa89c]">{file.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{file.title}</p>
                    <p className="capitalize text-[#9aa89c]">{file.type}</p>
                  </td>
                  <td className="px-4 py-3 text-[#9aa89c]">
                    {file.source}
                    <div>{new Date(file.uploadedAt).toLocaleString()}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{file.status}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {file.viewUrl && (
                        <a
                          href={file.viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#d4a574] underline"
                        >
                          View
                        </a>
                      )}
                      {file.downloadUrl && (
                        <a
                          href={file.downloadUrl}
                          className="text-[#d4a574] underline"
                        >
                          Download / Print
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="space-y-3">
          {dossiers.map((row) => (
            <li
              key={row.elderId}
              className="rounded border border-[#3d4a40] bg-[#121a16] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-semibold">{row.fullName}</p>
                  <p className="text-sm text-[#9aa89c]">
                    {row.phone} · {row.county}
                  </p>
                  <p className="mt-1 text-sm text-[#9aa89c]">{row.address}</p>
                  <p className="mt-2 text-sm text-[#9aa89c]">
                    {row.vaultStatus?.replace(/_/g, " ") || "no vault"}
                    {row.packageTier ? ` · ${row.packageTier}` : ""} ·{" "}
                    {row.fileCount} files · {row.heirsNote}
                    {row.idOnFile ? " · ID on file" : " · ID missing"}
                  </p>
                  <p className="mt-3 text-sm text-[#e8efe9]">
                    <span className="font-semibold">Family: </span>
                    {row.familyNote}
                  </p>
                  <p className="mt-1 text-sm text-[#e8efe9]">
                    <span className="font-semibold">Assets: </span>
                    {row.assetsNote}
                  </p>
                  {row.reviewNotes ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[#e8efe9]">
                      <span className="font-semibold">Review notes: </span>
                      {row.reviewNotes}
                    </p>
                  ) : null}
                  {row.opsNotes ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[#e8efe9]">
                      <span className="font-semibold">Ops notes: </span>
                      {row.opsNotes}
                    </p>
                  ) : null}
                  <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
                    {[
                      ["National ID", row.idOnFile],
                      ["Will builder draft", row.willDraft],
                      ["Family trust draft", row.trustDraft],
                      ["Burial wishes", row.burialWishes],
                      [
                        `${row.gpsPinned} GPS pin${row.gpsPinned === 1 ? "" : "s"}`,
                        row.gpsPinned > 0,
                      ],
                      [
                        `${row.testamentCount} voice testament${row.testamentCount === 1 ? "" : "s"}`,
                        row.testamentCount > 0,
                      ],
                      [
                        `${row.allocationCount} allocation${row.allocationCount === 1 ? "" : "s"}`,
                        row.allocationCount > 0,
                      ],
                      [
                        row.disputeCount
                          ? `${row.disputeCount} caveat / family alert`
                          : "No caveats",
                        row.disputeCount === 0,
                      ],
                    ].map(([label, done]) => (
                      <li
                        key={String(label)}
                        className={done ? "text-[#86efac]" : "text-[#9aa89c]"}
                      >
                        {done ? "●" : "○"} {label}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.inspectUrl && (
                    <Link
                      href={row.inspectUrl}
                      className="rounded border border-[#3d4a40] px-3 py-2 text-sm font-semibold hover:border-[#d4a574]"
                    >
                      Open full dossier
                    </Link>
                  )}
                  {row.latestBinderId && row.latestBinderStatus === "ready" ? (
                    <a
                      href={`/api/ops/binders/${row.latestBinderId}/download`}
                      className="rounded bg-[#2f5d45] px-3 py-2 text-sm font-semibold text-white"
                    >
                      Print master dossier
                    </a>
                  ) : (
                    <p className="max-w-xs text-sm text-[#9aa89c]">
                      Master PDF is built when an advocate seals the vault.
                      Open the vault for notes, IDs, and file-by-file print.
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
          {dossiers.length === 0 && (
            <li className="text-[#9aa89c]">No elders on file.</li>
          )}
        </ul>
      )}
    </div>
  );
}
