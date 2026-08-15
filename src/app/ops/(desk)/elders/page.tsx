"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ElderRow = {
  id: string;
  fullName: string;
  phone: string;
  createdAt: string;
  vaultId: string | null;
  vaultStatus: string | null;
  packageTier: string | null;
  forceLocked?: boolean;
  opsNotes?: string;
  binderStatus?: string | null;
  binderVersion?: number | null;
};

export default function OpsEldersPage() {
  const [q, setQ] = useState("");
  const [elders, setElders] = useState<ElderRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    const res = await fetch(`/api/ops/elders?q=${encodeURIComponent(query)}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setElders(json.results || []);
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Elder vault inspector</h1>
        <p className="mt-2 text-[#9aa89c]">
          Search by name, phone, status, or package. Open a vault for audit,
          force-lock, notes, and support mode.
        </p>
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
          placeholder="Search phone / name / status…"
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
      <ul className="space-y-2">
        {elders.map((e) => (
          <li
            key={e.id}
            className="rounded border border-[#3d4a40] bg-[#121a16] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{e.fullName}</p>
                <p className="text-sm text-[#9aa89c]">
                  {e.phone} · joined {new Date(e.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm capitalize text-[#d4a574]">
                  {e.vaultStatus?.replace("_", " ") || "no vault"}
                  {e.packageTier ? ` · ${e.packageTier}` : ""}
                  {e.forceLocked ? " · FORCE LOCKED" : ""}
                  {e.binderStatus
                    ? ` · binder v${e.binderVersion} ${e.binderStatus}`
                    : ""}
                </p>
              </div>
              {e.vaultId && (
                <Link
                  href={`/ops/vaults/${e.vaultId}`}
                  className="rounded bg-[#2f5d45] px-3 py-2 text-sm font-semibold text-white"
                >
                  Inspect vault
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
