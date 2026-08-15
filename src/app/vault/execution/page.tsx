"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";

type Trustee = { fullName: string; phone: string; idNumber: string };

type Plan = {
  trustees: Trustee[];
  minTrusteeApprovals: number;
  requireDeathCertificate: boolean;
  coolingHours: number;
};

export default function ExecutionPage() {
  const { locale } = useLocale();
  const [plan, setPlan] = useState<Plan>({
    trustees: [],
    minTrusteeApprovals: 2,
    requireDeathCertificate: true,
    coolingHours: 48,
  });
  const [vaultStatus, setVaultStatus] = useState("");
  const [asAgent, setAsAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/vault/execution");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to load");
      return;
    }
    setVaultStatus(data.vaultStatus || "");
    setAsAgent(Boolean(data.asAgent));
    if (data.plan) {
      setPlan({
        trustees: data.plan.trustees || [],
        minTrusteeApprovals: data.plan.minTrusteeApprovals || 2,
        requireDeathCertificate: data.plan.requireDeathCertificate !== false,
        coolingHours: data.plan.coolingHours ?? 48,
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function addTrustee() {
    setPlan((p) => ({
      ...p,
      trustees: [...p.trustees, { fullName: "", phone: "", idNumber: "" }],
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/vault/execution", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage(
        locale === "sw"
          ? "Mpango wa utekelezaji umehifadhiwa."
          : "Execution plan saved.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {locale === "sw" ? "Vichochezi vya utekelezaji" : "Execution triggers"}
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">
          {locale === "sw"
            ? "Weka amana za familia na sheria za jinsi mirathi itakavyoanza baada ya kifo. Hii si kifo — ni maandalizi."
            : "Name family trustees and rules for how succession starts after death. This is not a death claim — it is preparation."}
        </p>
        <p className="mt-2 text-base text-muted">
          Vault status:{" "}
          <span className="font-semibold capitalize text-forest">
            {vaultStatus.replace(/_/g, " ") || "…"}
          </span>
        </p>
      </div>

      {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
      {message && <p className="text-base font-medium text-forest">{message}</p>}
      {asAgent && (
        <p className="rounded-[0.35rem] border border-brass bg-[color-mix(in_srgb,var(--brass)_12%,white)] px-4 py-3 text-base">
          {locale === "sw"
            ? "Unaweza kuona. Ni mzee pekee anayeweza kuhifadhi mabadiliko."
            : "You can view this plan. Only the elder can save changes."}
        </p>
      )}

      <form
        onSubmit={save}
        className="space-y-5 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="minApprovals">
              {locale === "sw"
                ? "Idadi ya idhini za amana zinazohitajika"
                : "Trustee approvals required"}
            </label>
            <input
              id="minApprovals"
              type="number"
              min={1}
              max={5}
              className="field"
              value={plan.minTrusteeApprovals}
              disabled={asAgent}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  minTrusteeApprovals: Number(e.target.value) || 1,
                }))
              }
            />
          </div>
          <div>
            <label className="field-label" htmlFor="cooling">
              {locale === "sw"
                ? "Kipindi cha kusubiri baada ya ops (saa)"
                : "Cooling period after ops verify (hours)"}
            </label>
            <input
              id="cooling"
              type="number"
              min={0}
              max={720}
              className="field"
              value={plan.coolingHours}
              disabled={asAgent}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  coolingHours: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
        </div>

        <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={plan.requireDeathCertificate}
            disabled={asAgent}
            onChange={(e) =>
              setPlan((p) => ({
                ...p,
                requireDeathCertificate: e.target.checked,
              }))
            }
          />
          {locale === "sw"
            ? "Cheti cha kifo kinahitajika"
            : "Death certificate required to file"}
        </label>

        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-forest-deep">
              {locale === "sw" ? "Amana / wadhamini" : "Named trustees"}
            </h2>
            {!asAgent && (
              <button type="button" className="btn btn-secondary-dark" onClick={addTrustee}>
                {locale === "sw" ? "Ongeza" : "Add trustee"}
              </button>
            )}
          </div>
          <ul className="mt-4 space-y-4">
            {plan.trustees.map((t, idx) => (
              <li
                key={idx}
                className="grid gap-3 rounded-[0.35rem] border border-border p-4 sm:grid-cols-3"
              >
                <input
                  className="field"
                  placeholder={locale === "sw" ? "Jina kamili" : "Full name"}
                  value={t.fullName}
                  disabled={asAgent}
                  onChange={(e) => {
                    const trustees = [...plan.trustees];
                    trustees[idx] = { ...t, fullName: e.target.value };
                    setPlan((p) => ({ ...p, trustees }));
                  }}
                  required
                />
                <input
                  className="field"
                  placeholder="+2547…"
                  value={t.phone}
                  disabled={asAgent}
                  onChange={(e) => {
                    const trustees = [...plan.trustees];
                    trustees[idx] = { ...t, phone: e.target.value };
                    setPlan((p) => ({ ...p, trustees }));
                  }}
                  required
                />
                <div className="flex gap-2">
                  <input
                    className="field"
                    placeholder={locale === "sw" ? "Nambari ya ID" : "ID number"}
                    value={t.idNumber}
                    disabled={asAgent}
                    onChange={(e) => {
                      const trustees = [...plan.trustees];
                      trustees[idx] = { ...t, idNumber: e.target.value };
                      setPlan((p) => ({ ...p, trustees }));
                    }}
                  />
                  {!asAgent && (
                    <button
                      type="button"
                      className="btn btn-secondary-dark"
                      onClick={() =>
                        setPlan((p) => ({
                          ...p,
                          trustees: p.trustees.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
            {plan.trustees.length === 0 && (
              <li className="text-base text-muted">
                {locale === "sw"
                  ? "Hakuna amana bado. Bila amana, dai litaenda moja kwa moja kwa ops baada ya kuwasilisha."
                  : "No trustees yet. Without trustees, a filed claim goes straight to ops verification."}
              </li>
            )}
          </ul>
        </div>

        {!asAgent && (
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "…" : locale === "sw" ? "Hifadhi mpango" : "Save execution plan"}
          </button>
        )}
      </form>
    </div>
  );
}
