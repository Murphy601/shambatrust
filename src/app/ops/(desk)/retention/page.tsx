"use client";

import { useCallback, useEffect, useState } from "react";

type Expired = {
  id: string;
  vaultId: string;
  packageTier: string;
  completedAt: string | null;
  docAccessRevokedAt: string | null;
};

export default function OpsRetentionPage() {
  const [expired, setExpired] = useState<Expired[]>([]);
  const [days, setDays] = useState(90);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ops/retention?days=${days}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setExpired(json.expired || []);
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(reviewId: string) {
    setError(null);
    const res = await fetch("/api/ops/retention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", reviewId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setMessage(`Revoked doc access for ${reviewId}`);
    await load();
  }

  async function purge() {
    if (
      !confirm(
        `Purge sealed upload files older than ${days} days? This cannot be undone.`,
      )
    ) {
      return;
    }
    setError(null);
    const res = await fetch("/api/ops/retention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "purge", retentionDays: days }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setMessage(`Purged ${json.purged} file(s).`);
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Document retention</h1>
        <p className="mt-2 text-[#9aa89c]">
          Expire advocate doc access and purge sealed uploads past retention.
          Sealed Vault Binder PDFs under binders/ are permanent and never purged.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Retention days
          <input
            type="number"
            className="mt-1 block w-28 rounded border border-[#3d4a40] bg-[#0f1411] px-3 py-2"
            value={days}
            onChange={(e) => setDays(Number(e.target.value) || 90)}
          />
        </label>
        <button
          type="button"
          className="rounded bg-[#2f5d45] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => void load()}
        >
          Refresh
        </button>
        <button
          type="button"
          className="rounded border border-[#e07a5f] px-3 py-2 text-sm font-semibold text-[#e07a5f]"
          onClick={() => void purge()}
        >
          Purge expired uploads
        </button>
      </div>
      {error && <p className="text-[#e07a5f]">{error}</p>}
      {message && <p className="text-[#d4a574]">{message}</p>}
      <ul className="space-y-2">
        {expired.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#3d4a40] bg-[#121a16] p-4 text-sm"
          >
            <div>
              <p className="font-semibold capitalize">
                {r.packageTier} · {r.id.slice(0, 8)}…
              </p>
              <p className="text-[#9aa89c]">
                Completed {r.completedAt || "—"} · Revoked{" "}
                {r.docAccessRevokedAt || "not yet"}
              </p>
            </div>
            {!r.docAccessRevokedAt && (
              <button
                type="button"
                className="rounded border border-[#d4a574] px-3 py-2 text-[#d4a574]"
                onClick={() => void revoke(r.id)}
              >
                Revoke access now
              </button>
            )}
          </li>
        ))}
        {expired.length === 0 && (
          <li className="text-[#9aa89c]">No cases past retention window.</li>
        )}
      </ul>
    </div>
  );
}
