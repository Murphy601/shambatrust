"use client";

import { useCallback, useEffect, useState } from "react";
import type { BillingRecord, PaymentCheckout } from "@/lib/db/types";

export default function OpsBillingPage() {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [checkouts, setCheckouts] = useState<PaymentCheckout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/ops/billing");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    setRecords(json.records || []);
    setCheckouts(json.checkouts || []);
    setSeat(json.seat);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function togglePaid(id: string, paid: boolean) {
    setError(null);
    const res = await fetch("/api/ops/billing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, paid }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed");
      return;
    }
    await load();
  }

  function exportCsv() {
    const header = "id,kind,amountKes,paid,vaultId,detail,createdAt\n";
    const rows = records
      .map((r) =>
        [
          r.id,
          r.kind,
          r.amountKes,
          r.paid,
          r.vaultId || "",
          `"${r.detail.replace(/"/g, '""')}"`,
          r.createdAt,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shambatrust-billing-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const unpaid = records.filter((r) => !r.paid).reduce((s, r) => s + r.amountKes, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Billing desk</h1>
          <p className="mt-2 text-[#9aa89c]">
            Review / amendment / title-lookup events. Unpaid:{" "}
            <span className="font-semibold text-[#d4a574]">
              KES {unpaid.toLocaleString()}
            </span>
            {seat ? ` · seat ${seat}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded border border-[#d4a574] px-3 py-2 text-sm font-semibold text-[#d4a574]"
        >
          Export CSV
        </button>
      </div>
      {error && <p className="text-[#e07a5f]">{error}</p>}
      <ul className="space-y-2">
        {records.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-[#3d4a40] bg-[#121a16] p-4 text-sm"
          >
            <div>
              <p className="font-semibold capitalize text-[#e8efe9]">
                {r.kind.replace(/_/g, " ")} · {r.currency || "KES"} · KES{" "}
                {r.amountKes.toLocaleString()}
                {r.provider ? ` · ${r.provider}` : ""}
              </p>
              <p className="text-[#9aa89c]">{r.detail}</p>
              <p className="text-xs text-[#9aa89c]">
                {new Date(r.createdAt).toLocaleString()}
                {r.vaultId ? ` · vault ${r.vaultId.slice(0, 8)}…` : ""}
              </p>
            </div>
            <button
              type="button"
              className={`rounded px-3 py-2 font-semibold ${
                r.paid
                  ? "border border-[#3d4a40] text-[#9aa89c]"
                  : "bg-[#2f5d45] text-white"
              }`}
              onClick={() => void togglePaid(r.id, !r.paid)}
            >
              {r.paid ? "Mark unpaid" : "Mark paid"}
            </button>
          </li>
        ))}
        {records.length === 0 && (
          <li className="text-[#9aa89c]">No billing events yet.</li>
        )}
      </ul>
      {checkouts.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Diaspora checkouts</h2>
          <ul className="mt-3 space-y-2">
            {checkouts.map((c) => (
              <li
                key={c.id}
                className="rounded border border-[#3d4a40] bg-[#121a16] p-4 text-sm"
              >
                <p className="font-semibold">
                  {c.currency} {c.amount} · {c.provider} · {c.status}
                </p>
                <p className="text-[#9aa89c]">{c.detail}</p>
                {c.gatewayNote ? (
                  <p className="text-xs text-[#9aa89c]">{c.gatewayNote}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
