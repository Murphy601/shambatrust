"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import type { SuccessionCase } from "@/lib/db/types";

export default function SuccessionPage() {
  const { locale } = useLocale();
  const [vaultId, setVaultId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<
    Array<{ vaultId: string; ownerName: string; reason: string }>
  >([]);
  const [cases, setCases] = useState<SuccessionCase[]>([]);
  const [deathDate, setDeathDate] = useState("");
  const [filerNotes, setFilerNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Trustee approve
  const [approveCaseId, setApproveCaseId] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    const elig = await fetch("/api/succession/eligible");
    const eligData = await elig.json();
    const vaults = eligData.vaults || [];
    setEligible(vaults);
    if (vaults.length && !vaultId) {
      setVaultId(vaults[0].vaultId);
    }
    const vid = vaultId || vaults[0]?.vaultId;
    if (!vid) {
      setCases([]);
      return;
    }
    const res = await fetch(`/api/succession/cases?vaultId=${vid}`);
    const data = await res.json();
    if (res.ok) setCases(data.cases || []);
  }, [vaultId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function fileClaim(event: FormEvent) {
    event.preventDefault();
    if (!vaultId) {
      setError(
        locale === "sw"
          ? "Hakuna hifadhi. Ingia kama mrithi, amana, au wakala."
          : "No vault linked. Sign in as an heir, trustee, or family agent.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("vaultId", vaultId);
      form.set("deathDate", deathDate);
      form.set("filerNotes", filerNotes);
      if (file) form.set("file", file);
      const res = await fetch("/api/succession/cases", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not file");
      setMessage(
        locale === "sw"
          ? "Dai limetumwa. Amana wataidhinisha, kisha ops itakagua."
          : "Claim filed. Trustees must approve, then ops will verify.",
      );
      setFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not file");
    } finally {
      setBusy(false);
    }
  }

  async function requestTrusteeCode(caseId: string) {
    setBusy(true);
    setError(null);
    setApproveCaseId(caseId);
    try {
      const me = await fetch("/api/auth/me");
      const meData = await me.json();
      const phone = meData.user?.phone;
      if (!phone) throw new Error("No phone on session");
      const res = await fetch("/api/succession/approve?action=request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send code");
      setDevCode(data.devCode || null);
      setMessage(
        locale === "sw"
          ? "Msimbo umetumwa (au unaonekana chini katika hali ya majaribio)."
          : "Code sent (or shown below in dev mode).",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmTrustee(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const me = await fetch("/api/auth/me");
      const meData = await me.json();
      const phone = meData.user?.phone;
      const res = await fetch("/api/succession/approve?action=confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: approveCaseId,
          phone,
          code,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not approve");
      setMessage(
        locale === "sw"
          ? `Idhini imehifadhiwa (${data.approvedCount}/${data.required}).`
          : `Approval recorded (${data.approvedCount}/${data.required}).`,
      );
      setCode("");
      setDevCode(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {locale === "sw" ? "Dai la mirathi" : "Succession claim"}
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">
          {locale === "sw"
            ? "Wasilisha cheti cha kifo ili kuanzisha mirathi. Ops itathibitisha kabla ya wakili."
            : "File a death certificate to start succession. Ops must verify before an advocate takes over."}
        </p>
      </div>

      {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
      {message && <p className="text-base font-medium text-forest">{message}</p>}

      <form
        onSubmit={fileClaim}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {locale === "sw" ? "Wasilisha dai" : "File a claim"}
        </h2>
        {eligible.length === 0 ? (
          <p className="text-base text-muted">
            {locale === "sw"
              ? "Hakuna hifadhi iliyofungwa unayoweza kuwasilisha dai. Lazima uwe amana, mrithi, au wakala kwenye hifadhi iliyofungwa."
              : "No sealed vault you can file against. You must be a trustee, heir, or agent on a sealed vault."}
          </p>
        ) : (
          <div>
            <label className="field-label" htmlFor="vaultPick">
              {locale === "sw" ? "Hifadhi ya mzee" : "Elder vault"}
            </label>
            <select
              id="vaultPick"
              className="field"
              value={vaultId || ""}
              onChange={(e) => setVaultId(e.target.value)}
            >
              {eligible.map((v) => (
                <option key={v.vaultId} value={v.vaultId}>
                  {v.ownerName} ({v.reason})
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="field-label" htmlFor="deathDate">
            {locale === "sw" ? "Tarehe ya kifo" : "Date of death"}
          </label>
          <input
            id="deathDate"
            type="date"
            className="field"
            value={deathDate}
            onChange={(e) => setDeathDate(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="field-label" htmlFor="cert">
            {locale === "sw" ? "Cheti cha kifo" : "Death certificate"}
          </label>
          <input
            id="cert"
            type="file"
            accept=".pdf,image/*"
            className="field"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="notes">
            {locale === "sw" ? "Maelezo" : "Notes"}
          </label>
          <textarea
            id="notes"
            className="field min-h-24"
            value={filerNotes}
            onChange={(e) => setFilerNotes(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !vaultId}>
          {busy ? "…" : locale === "sw" ? "Wasilisha dai" : "Submit claim"}
        </button>
      </form>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          {locale === "sw" ? "Madai yaliyopo" : "Existing claims"}
        </h2>
        {cases.length === 0 ? (
          <p className="mt-3 text-lg text-muted">
            {locale === "sw" ? "Hakuna dai bado." : "No claims yet."}
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {cases.map((c) => (
              <li key={c.id} className="border-l-4 border-forest pl-3">
                <p className="text-lg font-semibold capitalize text-ink">
                  {c.status.replace(/_/g, " ")}
                </p>
                <p className="text-base text-muted">
                  Death: {c.deathDate} · Filed{" "}
                  {new Date(c.createdAt).toLocaleString()}
                </p>
                {c.deathCertificatePath && (
                  <a
                    className="mt-1 inline-block font-semibold text-forest underline"
                    href={`/api/secure-docs/view?kind=death_cert&caseId=${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {locale === "sw" ? "Angalia cheti (kuona tu)" : "View certificate (view only)"}
                  </a>
                )}
                {(c.status === "awaiting_trustee_otps" ||
                  c.status === "succession_filed") && (
                  <button
                    type="button"
                    className="btn btn-secondary-dark mt-3"
                    disabled={busy}
                    onClick={() => requestTrusteeCode(c.id)}
                  >
                    {locale === "sw"
                      ? "Idhinisha kama amana (OTP)"
                      : "Approve as trustee (OTP)"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {approveCaseId && (
        <form
          onSubmit={confirmTrustee}
          className="space-y-3 rounded-[0.45rem] border-2 border-brass bg-surface p-5"
        >
          <h3 className="text-xl font-semibold text-forest-deep">
            {locale === "sw" ? "Thibitisha OTP ya amana" : "Confirm trustee OTP"}
          </h3>
          {devCode && (
            <p className="text-lg font-semibold text-soil">
              Dev code: <span className="tracking-widest">{devCode}</span>
            </p>
          )}
          <input
            className="field tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {locale === "sw" ? "Thibitisha" : "Confirm approval"}
          </button>
        </form>
      )}
    </div>
  );
}
