"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type SupportPayload = {
  session: {
    id: string;
    vaultId: string;
    elderUserId: string;
    expiresAt: string;
    note: string;
  };
  vault: { id: string; status: string; packageTier: string | null; opsNotes: string };
  owner: { fullName: string; phone: string } | null;
  assets: Array<{ title: string; type: string }>;
  beneficiaries: Array<{ fullName: string; relationship: string }>;
  readOnly: true;
};

export default function OpsSupportPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [data, setData] = useState<SupportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/ops/support/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed");
        return;
      }
      setData(json);
    })();
  }, [id]);

  if (error) return <p className="text-[#e07a5f]">{error}</p>;
  if (!data) return <p className="text-[#9aa89c]">Loading support view…</p>;

  return (
    <div className="space-y-6">
      <div className="rounded border border-[#d4a574] bg-[#d4a574]/10 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[#d4a574]">
          Support mode · view-as-elder · read-only
        </p>
        <p className="mt-1 text-sm text-[#9aa89c]">
          Expires {new Date(data.session.expiresAt).toLocaleString()} ·{" "}
          {data.session.note}
        </p>
      </div>
      <div>
        <h1 className="text-3xl font-semibold">
          {data.owner?.fullName || "Elder vault"}
        </h1>
        <p className="mt-2 text-[#9aa89c]">
          {data.owner?.phone} · {data.vault.status.replace("_", " ")}
        </p>
      </div>
      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Assets</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {data.assets.map((a, i) => (
            <li key={i}>
              {a.title} ({a.type})
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded border border-[#3d4a40] bg-[#121a16] p-5">
        <h2 className="text-xl font-semibold">Heirs</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {data.beneficiaries.map((b, i) => (
            <li key={i}>
              {b.fullName} — {b.relationship}
            </li>
          ))}
        </ul>
      </section>
      <Link
        href={`/ops/vaults/${data.vault.id}`}
        className="text-[#d4a574] underline"
      >
        ← Full vault inspector
      </Link>
    </div>
  );
}
