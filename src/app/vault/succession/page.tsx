"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import type { SuccessionCase } from "@/lib/db/types";

type EligibleVault = {
  vaultId: string;
  ownerName: string;
  reason: string;
};

/** Human labels for the confirmation stages, so filers know who is holding it up. */
function stageCopy(status: string, sw: boolean): string {
  switch (status) {
    case "succession_filed":
      return sw ? "Dai limewasilishwa" : "Claim filed";
    case "awaiting_trustee_otps":
      return sw ? "Inasubiri idhini za amana" : "Waiting for trustee approvals";
    case "awaiting_guardian_confirmations":
      return sw
        ? "Inasubiri uthibitisho wa walezi wawili"
        : "Waiting for two guardian confirmations";
    case "pending_ops_verification":
      return sw ? "Inasubiri uhakiki wa ShambaTrust" : "Waiting for ShambaTrust verification";
    case "succession_verified":
      return sw ? "Imethibitishwa — kipindi cha kusubiri" : "Verified — cooling period";
    case "with_advocate":
      return sw ? "Iko kwa wakili" : "With the advocate";
    case "succession_completed":
      return sw ? "Imekamilika" : "Completed";
    case "succession_rejected":
      return sw ? "Imekataliwa" : "Rejected";
    default:
      return status.replace(/_/g, " ");
  }
}

export default function SuccessionPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";

  const [vaultId, setVaultId] = useState<string | null>(null);
  const [eligible, setEligible] = useState<EligibleVault[]>([]);
  const [cases, setCases] = useState<SuccessionCase[]>([]);
  const [deathDate, setDeathDate] = useState("");
  const [filerNotes, setFilerNotes] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [notification, setNotification] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Trustee / guardian confirmation
  const [approveCaseId, setApproveCaseId] = useState("");
  const [approveRole, setApproveRole] = useState<"trustee" | "guardian" | null>(
    null,
  );
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const load = useCallback(async () => {
    const elig = await fetch("/api/succession/eligible");
    const eligData = await elig.json();
    const vaults: EligibleVault[] = eligData.vaults || [];
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
    void (async () => {
      await load();
    })();
  }, [load]);

  async function fileClaim(event: FormEvent) {
    event.preventDefault();
    if (!vaultId) {
      setError(
        sw
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
      if (certificate) form.set("file", certificate);
      if (notification) form.set("notificationFile", notification);
      const res = await fetch("/api/succession/cases", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not file");
      setMessage(
        sw
          ? "Dai limetumwa. Amana na walezi wanapaswa kuthibitisha, kisha ops itakagua."
          : "Claim filed. Trustees then guardians must confirm before ops verify it.",
      );
      setCertificate(null);
      setNotification(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not file");
    } finally {
      setBusy(false);
    }
  }

  async function requestConfirmationCode(caseId: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
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
      setApproveRole(data.role || null);
      setDevCode(data.devCode || null);
      setMessage(
        sw
          ? "Msimbo umetumwa (au unaonekana chini katika hali ya majaribio)."
          : "Code sent (or shown below in dev mode).",
      );
    } catch (e) {
      setApproveCaseId("");
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
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
        body: JSON.stringify({ caseId: approveCaseId, phone, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not confirm");
      setMessage(
        sw
          ? `Uthibitisho umehifadhiwa: amana ${data.trusteeApproved}/${data.trusteeRequired} · walezi ${data.guardianApproved}/${data.guardianRequired}.`
          : `Confirmation recorded: trustees ${data.trusteeApproved}/${data.trusteeRequired} · guardians ${data.guardianApproved}/${data.guardianRequired}.`,
      );
      setCode("");
      setDevCode(null);
      setApproveCaseId("");
      setApproveRole(null);
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
          {sw ? "Kuanzisha mirathi" : "Succession activation"}
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">
          {sw
            ? "Wasilisha taarifa na cheti cha kifo ili kuanzisha mirathi. Amana huanzisha, walezi wawili huthibitisha, kisha ShambaTrust huhakiki kabla hifadhi kufunguliwa."
            : "File the death notification and certificate to start succession. Trustees begin it, two guardians confirm it, and ShambaTrust verifies before the vault is opened to executors."}
        </p>
      </div>

      {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
      {message && <p className="text-base font-medium text-forest">{message}</p>}

      <form
        onSubmit={fileClaim}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Wasilisha dai" : "File a claim"}
        </h2>
        {eligible.length === 0 ? (
          <p className="text-base text-muted">
            {sw
              ? "Hakuna hifadhi iliyofungwa unayoweza kuwasilisha dai. Lazima uwe amana, mrithi, au wakala kwenye hifadhi iliyofungwa."
              : "No sealed vault you can file against. You must be a trustee, heir, or agent on a sealed vault."}
          </p>
        ) : (
          <div>
            <label className="field-label" htmlFor="vaultPick">
              {sw ? "Hifadhi ya mzee" : "Elder vault"}
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
            {sw ? "Tarehe ya kifo" : "Date of death"}
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
          <label className="field-label" htmlFor="notice">
            {sw
              ? "Taarifa rasmi ya kifo (fomu ya chifu / hospitali)"
              : "Official death notification (chief's or hospital form)"}
          </label>
          <input
            id="notice"
            type="file"
            accept=".pdf,image/*"
            className="field"
            onChange={(e) => setNotification(e.target.files?.[0] || null)}
          />
          <p className="mt-1 text-base text-muted">
            {sw
              ? "Hii hutolewa ndani ya siku chache baada ya kifo."
              : "This is issued within a few days of the death, well before the certificate."}
          </p>
        </div>
        <div>
          <label className="field-label" htmlFor="cert">
            {sw ? "Cheti cha kifo" : "Death certificate"}
          </label>
          <input
            id="cert"
            type="file"
            accept=".pdf,image/*"
            className="field"
            onChange={(e) => setCertificate(e.target.files?.[0] || null)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="notes">
            {sw ? "Maelezo" : "Notes"}
          </label>
          <textarea
            id="notes"
            className="field min-h-24"
            value={filerNotes}
            onChange={(e) => setFilerNotes(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !vaultId}>
          {busy ? "…" : sw ? "Wasilisha dai" : "Submit claim"}
        </button>
      </form>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Madai yaliyopo" : "Existing claims"}
        </h2>
        {cases.length === 0 ? (
          <p className="mt-3 text-lg text-muted">
            {sw ? "Hakuna dai bado." : "No claims yet."}
          </p>
        ) : (
          <ul className="mt-4 space-y-5">
            {cases.map((c) => (
              <li key={c.id} className="border-l-4 border-forest pl-3">
                <p className="text-lg font-semibold text-ink">
                  {stageCopy(c.status, sw)}
                </p>
                <p className="text-base text-muted">
                  {sw ? "Kifo" : "Death"}: {c.deathDate} ·{" "}
                  {sw ? "Imewasilishwa" : "Filed"}{" "}
                  {new Date(c.createdAt).toLocaleString()}
                </p>

                <div className="mt-2 flex flex-wrap gap-4">
                  {c.deathNotificationPath && (
                    <a
                      className="font-semibold text-forest underline"
                      href={`/api/secure-docs/view?kind=death_notification&caseId=${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {sw ? "Angalia taarifa ya kifo" : "View death notification"}
                    </a>
                  )}
                  {c.deathCertificatePath && (
                    <a
                      className="font-semibold text-forest underline"
                      href={`/api/secure-docs/view?kind=death_cert&caseId=${c.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {sw ? "Angalia cheti (kuona tu)" : "View certificate (view only)"}
                    </a>
                  )}
                </div>

                {c.vaultReleasedAt ? (
                  <p className="mt-3 rounded-[0.35rem] border-2 border-forest bg-[color-mix(in_srgb,var(--forest)_10%,white)] px-3 py-2 text-base font-semibold text-forest-deep">
                    {sw
                      ? `Hifadhi ilifunguliwa kwa watekelezaji ${new Date(c.vaultReleasedAt).toLocaleString()}.`
                      : `Vault released to executors on ${new Date(c.vaultReleasedAt).toLocaleString()}.`}
                  </p>
                ) : null}

                {(c.status === "awaiting_trustee_otps" ||
                  c.status === "awaiting_guardian_confirmations" ||
                  c.status === "succession_filed") && (
                  <button
                    type="button"
                    className="btn btn-secondary-dark mt-3"
                    disabled={busy}
                    onClick={() => void requestConfirmationCode(c.id)}
                  >
                    {c.status === "awaiting_guardian_confirmations"
                      ? sw
                        ? "Thibitisha kama mlezi (OTP)"
                        : "Confirm as guardian (OTP)"
                      : sw
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
          onSubmit={confirm}
          className="space-y-3 rounded-[0.45rem] border-2 border-brass bg-surface p-5"
        >
          <h2 className="text-xl font-semibold text-forest-deep">
            {approveRole === "guardian"
              ? sw
                ? "Thibitisha OTP ya mlezi"
                : "Confirm guardian OTP"
              : sw
                ? "Thibitisha OTP ya amana"
                : "Confirm trustee OTP"}
          </h2>
          {devCode && (
            <p className="text-lg font-semibold text-soil">
              Dev code: <span className="tracking-widest">{devCode}</span>
            </p>
          )}
          <label className="field-label" htmlFor="otpCode">
            {sw ? "Msimbo wa tarakimu 6" : "6-digit code"}
          </label>
          <input
            id="otpCode"
            className="field tracking-[0.3em]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
            inputMode="numeric"
            required
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {sw ? "Thibitisha" : "Confirm"}
          </button>
        </form>
      )}
    </div>
  );
}
