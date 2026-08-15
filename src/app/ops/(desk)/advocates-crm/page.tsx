"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@/lib/db/types";

type Row = {
  user: User;
  activeCases: number;
  completedCases: number;
};

export default function OpsAdvocatesCrmPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/advocates-crm");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setRows(json.advocates || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(userId: string, body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/ops/advocates-crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Advocate CRM</h1>
        <p className="mt-2 text-[#9aa89c]">
          Capacity, active cases, performance. Suspend or reactivate partners.
        </p>
      </div>
      {error && <p className="text-[#e07a5f]">{error}</p>}
      <ul className="space-y-3">
        {rows.map(({ user, activeCases, completedCases }) => (
          <li
            key={user.id}
            className="rounded border border-[#3d4a40] bg-[#121a16] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{user.fullName}</p>
                <p className="text-sm text-[#9aa89c]">
                  {user.phone} · LSK {user.advocateLicense || "—"}
                </p>
                <p className="mt-2 text-sm text-[#d4a574]">
                  Active {activeCases}
                  {user.advocateMaxCases != null
                    ? ` / max ${user.advocateMaxCases}`
                    : ""}{" "}
                  · Completed {completedCases}
                  {user.advocateSuspended ? " · SUSPENDED" : ""}
                  {user.advocateOooUntil
                    ? ` · OOO until ${new Date(user.advocateOooUntil).toLocaleDateString()}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded border border-[#3d4a40] px-3 py-2 text-sm"
                  onClick={() =>
                    void patch(user.id, {
                      advocateSuspended: !user.advocateSuspended,
                    })
                  }
                >
                  {user.advocateSuspended ? "Reactivate" : "Suspend"}
                </button>
                <button
                  type="button"
                  className="rounded border border-[#3d4a40] px-3 py-2 text-sm"
                  onClick={() => {
                    const n = window.prompt(
                      "Max concurrent cases",
                      String(user.advocateMaxCases ?? 10),
                    );
                    if (n == null) return;
                    void patch(user.id, { advocateMaxCases: Number(n) || 10 });
                  }}
                >
                  Set capacity
                </button>
              </div>
            </div>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="text-[#9aa89c]">No approved advocates yet.</li>
        )}
      </ul>
    </div>
  );
}
