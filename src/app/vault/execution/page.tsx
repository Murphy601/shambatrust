"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";

type Trustee = { fullName: string; phone: string; idNumber: string };
type Guardian = Trustee & { relationship: string };

type Plan = {
  trustees: Trustee[];
  minTrusteeApprovals: number;
  guardians: Guardian[];
  minGuardianApprovals: number;
  enforcer: {
    fullName: string;
    phone: string;
    idNumber: string;
    organization: string;
  } | null;
  minCoSignApprovals: number;
  requireDeathCertificate: boolean;
  requireDeathNotification: boolean;
  coolingHours: number;
};

const DEFAULT_PLAN: Plan = {
  trustees: [],
  minTrusteeApprovals: 2,
  guardians: [],
  minGuardianApprovals: 2,
  enforcer: null,
  minCoSignApprovals: 2,
  requireDeathCertificate: true,
  requireDeathNotification: true,
  coolingHours: 48,
};

export default function ExecutionPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";
  const [plan, setPlan] = useState<Plan>(DEFAULT_PLAN);
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
      const guardians: Guardian[] = data.plan.guardians || [];
      setPlan({
        trustees: data.plan.trustees || [],
        minTrusteeApprovals: data.plan.minTrusteeApprovals || 2,
        guardians,
        minGuardianApprovals:
          data.plan.minGuardianApprovals ?? Math.min(2, guardians.length),
        enforcer: data.plan.enforcer || null,
        minCoSignApprovals: data.plan.minCoSignApprovals || 2,
        requireDeathCertificate: data.plan.requireDeathCertificate !== false,
        requireDeathNotification: Boolean(data.plan.requireDeathNotification),
        coolingHours: data.plan.coolingHours ?? 48,
      });
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/vault/execution", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...plan,
          enforcer: plan.enforcer?.fullName.trim() ? plan.enforcer : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage(
        sw
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
          {sw ? "Vichochezi vya utekelezaji" : "Execution triggers"}
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">
          {sw
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
          {sw
            ? "Unaweza kuona. Ni mzee pekee anayeweza kuhifadhi mabadiliko."
            : "You can view this plan. Only the elder can save changes."}
        </p>
      )}

      <form
        onSubmit={save}
        className="space-y-6 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="minApprovals">
              {sw
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
              {sw
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

        <fieldset className="space-y-2">
          <legend className="text-xl font-semibold text-forest-deep">
            {sw ? "Uthibitisho unaohitajika" : "Proof required to file"}
          </legend>
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
            {sw
              ? "Cheti cha kifo kinahitajika"
              : "Death certificate required to file"}
          </label>
          <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={plan.requireDeathNotification}
              disabled={asAgent}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  requireDeathNotification: e.target.checked,
                }))
              }
            />
            {sw
              ? "Taarifa rasmi ya kifo (fomu ya chifu / hospitali)"
              : "Official death notification (chief's or hospital form)"}
          </label>
          <p className="text-base text-muted">
            {sw
              ? "Taarifa ya kifo hupatikana kwa siku chache; cheti huchukua wiki. Kuomba vyote viwili hufanya udanganyifu kuwa mgumu zaidi."
              : "A death notification is issued within days; the certificate takes weeks. Requiring both makes a fraudulent claim much harder."}
          </p>
        </fieldset>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-forest-deep">
              {sw ? "Amana / wadhamini" : "Named trustees"}
            </h2>
            {!asAgent && (
              <button
                type="button"
                className="btn btn-secondary-dark"
                onClick={() =>
                  setPlan((p) => ({
                    ...p,
                    trustees: [
                      ...p.trustees,
                      { fullName: "", phone: "", idNumber: "" },
                    ],
                  }))
                }
              >
                {sw ? "Ongeza" : "Add trustee"}
              </button>
            )}
          </div>
          <p className="mt-1 text-base text-muted">
            {sw
              ? "Amana huanzisha dai kwa msimbo wa OTP."
              : "Trustees start the claim with an OTP code."}
          </p>
          <ul className="mt-4 space-y-4">
            {plan.trustees.map((t, idx) => (
              <li
                key={idx}
                className="grid gap-3 rounded-[0.35rem] border border-border p-4 sm:grid-cols-3"
              >
                <input
                  className="field"
                  aria-label={sw ? "Jina kamili" : "Trustee full name"}
                  placeholder={sw ? "Jina kamili" : "Full name"}
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
                  aria-label={sw ? "Simu ya amana" : "Trustee phone"}
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
                    aria-label={sw ? "Nambari ya ID" : "Trustee ID number"}
                    placeholder={sw ? "Nambari ya ID" : "ID number"}
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
                      aria-label={sw ? "Ondoa amana" : "Remove trustee"}
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
                {sw
                  ? "Hakuna amana bado. Bila amana, dai litaenda moja kwa moja kwa ops baada ya kuwasilisha."
                  : "No trustees yet. Without trustees, a filed claim goes straight to ops verification."}
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-[0.35rem] border-2 border-forest p-4">
          <h2 className="text-xl font-semibold text-forest-deep">
            {sw ? "Enforcer (mpatanishi huru)" : "Enforcer (independent mediator)"}
          </h2>
          <p className="mt-1 text-base text-muted">
            {sw
              ? "Wakili au mpatanishi anayevunja mkwamo kati ya wateule au warithi."
              : "An LSK advocate or mediator who resolves deadlocks between co-trustees or joint heirs."}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              className="field"
              placeholder={sw ? "Jina kamili" : "Full name"}
              value={plan.enforcer?.fullName || ""}
              disabled={asAgent}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  enforcer: {
                    fullName: e.target.value,
                    phone: p.enforcer?.phone || "",
                    idNumber: p.enforcer?.idNumber || "",
                    organization: p.enforcer?.organization || "",
                  },
                }))
              }
            />
            <input
              className="field"
              placeholder="+2547…"
              value={plan.enforcer?.phone || ""}
              disabled={asAgent}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  enforcer: {
                    fullName: p.enforcer?.fullName || "",
                    phone: e.target.value,
                    idNumber: p.enforcer?.idNumber || "",
                    organization: p.enforcer?.organization || "",
                  },
                }))
              }
            />
            <input
              className="field"
              placeholder={sw ? "Nambari ya ID" : "ID number"}
              value={plan.enforcer?.idNumber || ""}
              disabled={asAgent}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  enforcer: {
                    fullName: p.enforcer?.fullName || "",
                    phone: p.enforcer?.phone || "",
                    idNumber: e.target.value,
                    organization: p.enforcer?.organization || "",
                  },
                }))
              }
            />
            <input
              className="field"
              placeholder={sw ? "Kampuni / LSK" : "Firm / LSK"}
              value={plan.enforcer?.organization || ""}
              disabled={asAgent}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  enforcer: {
                    fullName: p.enforcer?.fullName || "",
                    phone: p.enforcer?.phone || "",
                    idNumber: p.enforcer?.idNumber || "",
                    organization: e.target.value,
                  },
                }))
              }
            />
          </div>
          <div className="mt-4 max-w-xs">
            <label className="field-label" htmlFor="cosign">
              {sw ? "Sahihi za familia zinazohitajika" : "Family co-signatures required"}
            </label>
            <input
              id="cosign"
              type="number"
              min={2}
              max={5}
              className="field"
              value={plan.minCoSignApprovals}
              disabled={asAgent}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  minCoSignApprovals: Number(e.target.value) || 2,
                }))
              }
            />
          </div>
        </div>

        <div className="rounded-[0.35rem] border-2 border-brass p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-forest-deep">
              {sw ? "Walezi (uthibitisho maradufu)" : "Guardians (dual verification)"}
            </h2>
            {!asAgent && (
              <button
                type="button"
                className="btn btn-secondary-dark"
                onClick={() =>
                  setPlan((p) => ({
                    ...p,
                    guardians: [
                      ...p.guardians,
                      { fullName: "", phone: "", idNumber: "", relationship: "" },
                    ],
                    minGuardianApprovals:
                      p.guardians.length + 1 >= 2 ? Math.max(2, p.minGuardianApprovals) : 0,
                  }))
                }
              >
                {sw ? "Ongeza mlezi" : "Add guardian"}
              </button>
            )}
          </div>
          <p className="mt-1 text-base text-muted">
            {sw
              ? "Baada ya amana kuidhinisha, walezi wawili tofauti lazima wathibitishe kabla ops kuangalia dai. Mtu mmoja hawezi kuthibitisha mara mbili."
              : "After the trustees approve, two different guardians must separately confirm before ops even look at the claim. One person cannot confirm twice."}
          </p>

          <div className="mt-4 max-w-xs">
            <label className="field-label" htmlFor="minGuardians">
              {sw ? "Uthibitisho wa walezi unaohitajika" : "Guardian confirmations required"}
            </label>
            <input
              id="minGuardians"
              type="number"
              min={0}
              max={5}
              className="field"
              value={plan.minGuardianApprovals}
              disabled={asAgent || plan.guardians.length === 0}
              onChange={(e) =>
                setPlan((p) => ({
                  ...p,
                  minGuardianApprovals: Number(e.target.value) || 0,
                }))
              }
            />
          </div>

          <ul className="mt-4 space-y-4">
            {plan.guardians.map((g, idx) => (
              <li
                key={idx}
                className="grid gap-3 rounded-[0.35rem] border border-border p-4 sm:grid-cols-2"
              >
                <input
                  className="field"
                  aria-label={sw ? "Jina kamili la mlezi" : "Guardian full name"}
                  placeholder={sw ? "Jina kamili" : "Full name"}
                  value={g.fullName}
                  disabled={asAgent}
                  onChange={(e) => {
                    const guardians = [...plan.guardians];
                    guardians[idx] = { ...g, fullName: e.target.value };
                    setPlan((p) => ({ ...p, guardians }));
                  }}
                  required
                />
                <input
                  className="field"
                  aria-label={sw ? "Simu ya mlezi" : "Guardian phone"}
                  placeholder="+2547…"
                  value={g.phone}
                  disabled={asAgent}
                  onChange={(e) => {
                    const guardians = [...plan.guardians];
                    guardians[idx] = { ...g, phone: e.target.value };
                    setPlan((p) => ({ ...p, guardians }));
                  }}
                  required
                />
                <input
                  className="field"
                  aria-label={sw ? "Uhusiano" : "Guardian relationship"}
                  placeholder={
                    sw ? "Uhusiano (mf. mtoto wa kwanza)" : "Relationship (e.g. eldest son)"
                  }
                  value={g.relationship}
                  disabled={asAgent}
                  onChange={(e) => {
                    const guardians = [...plan.guardians];
                    guardians[idx] = { ...g, relationship: e.target.value };
                    setPlan((p) => ({ ...p, guardians }));
                  }}
                />
                <div className="flex gap-2">
                  <input
                    className="field"
                    aria-label={sw ? "Nambari ya ID ya mlezi" : "Guardian ID number"}
                    placeholder={sw ? "Nambari ya ID" : "ID number"}
                    value={g.idNumber}
                    disabled={asAgent}
                    onChange={(e) => {
                      const guardians = [...plan.guardians];
                      guardians[idx] = { ...g, idNumber: e.target.value };
                      setPlan((p) => ({ ...p, guardians }));
                    }}
                  />
                  {!asAgent && (
                    <button
                      type="button"
                      className="btn btn-secondary-dark"
                      aria-label={sw ? "Ondoa mlezi" : "Remove guardian"}
                      onClick={() =>
                        setPlan((p) => {
                          const guardians = p.guardians.filter(
                            (_, i) => i !== idx,
                          );
                          return {
                            ...p,
                            guardians,
                            minGuardianApprovals: Math.min(
                              p.minGuardianApprovals,
                              guardians.length,
                            ),
                          };
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
            {plan.guardians.length === 0 && (
              <li className="text-base text-muted">
                {sw
                  ? "Hakuna walezi. Ukiongeza wawili, hakuna atakayeweza kufungua hifadhi peke yake."
                  : "No guardians yet. Add two and nobody will be able to open the vault alone."}
              </li>
            )}
          </ul>
        </div>

        {!asAgent && (
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "…" : sw ? "Hifadhi mpango" : "Save execution plan"}
          </button>
        )}
      </form>
    </div>
  );
}
