"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Lookup = {
  id: string;
  vaultId: string;
  titleNumber: string;
  county: string;
  costKes: number;
  createdAt: string;
  requesterName: string;
  requesterRole: string | null;
  ownerName: string | null;
  result: { found: boolean; registrationStatus: string };
};

export default function OpsTitleLookupsPage() {
  const [lookups, setLookups] = useState<Lookup[]>([]);
  const [totalKes, setTotalKes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/ops/title-lookups");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed");
        return;
      }
      setLookups(json.lookups || []);
      setTotalKes(json.totalKes || 0);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Title-search ledger</h1>
        <p className="mt-2 text-[#9aa89c]">
          Every ArdhiSasa / registry lookup with cost and requester. Total:{" "}
          <span className="font-semibold text-[#d4a574]">
            KES {totalKes.toLocaleString()}
          </span>
        </p>
      </div>
      {error && <p className="text-[#e07a5f]">{error}</p>}
      <ul className="space-y-2">
        {lookups.map((l) => (
          <li
            key={l.id}
            className="rounded border border-[#3d4a40] bg-[#121a16] p-4 text-sm"
          >
            <p className="font-semibold text-[#e8efe9]">
              {l.titleNumber || "(no title #)"} · {l.county || "—"} · KES{" "}
              {l.costKes.toLocaleString()}
            </p>
            <p className="text-[#9aa89c]">
              By {l.requesterName}
              {l.requesterRole ? ` (${l.requesterRole})` : ""} · Elder{" "}
              {l.ownerName || "—"} ·{" "}
              {l.result.found ? "found" : "not found"} ·{" "}
              {l.result.registrationStatus}
            </p>
            <p className="mt-1 text-xs text-[#9aa89c]">
              {new Date(l.createdAt).toLocaleString()}{" "}
              <Link
                href={`/ops/vaults/${l.vaultId}`}
                className="text-[#d4a574] underline"
              >
                vault
              </Link>
            </p>
          </li>
        ))}
        {lookups.length === 0 && (
          <li className="text-[#9aa89c]">No title lookups yet.</li>
        )}
      </ul>
    </div>
  );
}
