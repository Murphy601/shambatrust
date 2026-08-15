"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuditRow = {
  id: string;
  vaultId: string;
  action: string;
  detail: string;
  createdAt: string;
  actorName: string;
  actorRole: string | null;
};

export default function OpsActivityPage() {
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/ops/overview");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed");
        return;
      }
      setAudit(json.audit || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Activity log</h1>
        <p className="mt-2 text-[#9aa89c]">
          Automatic record of submissions, views, assignments, seals, and ops
          opens.
        </p>
      </div>
      {error && <p className="text-[#e07a5f]">{error}</p>}
      <ul className="space-y-2">
        {audit.map((row) => (
          <li
            key={row.id}
            className="rounded border border-[#3d4a40] bg-[#121a16] px-4 py-3 text-sm"
          >
            <p className="font-semibold">
              {row.action.replace(/_/g, " ")}{" "}
              <span className="font-normal text-[#9aa89c]">
                · {row.actorName}
                {row.actorRole ? ` (${row.actorRole})` : ""}
              </span>
            </p>
            <p className="mt-1 text-[#e8efe9]">{row.detail}</p>
            <p className="mt-1 text-[#9aa89c]">
              {new Date(row.createdAt).toLocaleString()} ·{" "}
              <Link
                href={`/ops/vaults/${row.vaultId}`}
                className="text-[#d4a574] underline"
              >
                vault
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
