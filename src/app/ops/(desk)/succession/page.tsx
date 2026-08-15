"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CaseRow = {
  id: string;
  vaultId: string;
  status: string;
  deathDate: string;
  createdAt: string;
  ownerName: string;
  filerName: string;
  approvedCount: number;
  requiredApprovals: number;
};

export default function OpsSuccessionListPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/ops/succession");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed");
        return;
      }
      setCases(json.cases || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Succession queue</h1>
        <p className="mt-2 text-[#9aa89c]">
          Death claims appear here automatically. Verify before advocate handoff.
        </p>
      </div>
      {error && <p className="text-[#e07a5f]">{error}</p>}
      <ul className="space-y-3">
        {cases.map((c) => (
          <li
            key={c.id}
            className="rounded border border-[#3d4a40] bg-[#121a16] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{c.ownerName}</p>
                <p className="text-sm text-[#9aa89c]">
                  Filed by {c.filerName} · death {c.deathDate}
                </p>
                <p className="mt-1 text-sm capitalize text-[#d4a574]">
                  {c.status.replace(/_/g, " ")} · trustees{" "}
                  {c.approvedCount}/{c.requiredApprovals || "—"}
                </p>
                <p className="text-xs text-[#9aa89c]">
                  {new Date(c.createdAt).toLocaleString()}
                </p>
              </div>
              <Link
                href={`/ops/succession/${c.id}`}
                className="rounded bg-[#2f5d45] px-3 py-2 text-sm font-semibold text-white"
              >
                Open
              </Link>
            </div>
          </li>
        ))}
        {cases.length === 0 && !error && (
          <li className="text-[#9aa89c]">No succession claims yet.</li>
        )}
      </ul>
    </div>
  );
}
