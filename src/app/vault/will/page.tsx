"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PlatformDisclaimer } from "@/components/platform-disclaimer";
import { useLocale } from "@/components/locale-provider";

const STEPS = 5;

export default function WillBuilderPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";
  const [step, setStep] = useState(1);
  const [testatorName, setTestatorName] = useState("");
  const [testatorId, setTestatorId] = useState("");
  const [primaryResidence, setPrimaryResidence] = useState("");
  const [executorName, setExecutorName] = useState("");
  const [executorPhone, setExecutorPhone] = useState("");
  const [altExecutorName, setAltExecutorName] = useState("");
  const [altExecutorPhone, setAltExecutorPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [altGuardianName, setAltGuardianName] = useState("");
  const [witnessAcknowledged, setWitnessAcknowledged] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/vault/will");
      const json = await res.json();
      const d = json.draft;
      if (!d) return;
      setTestatorName(d.testatorName || "");
      setTestatorId(d.testatorId || "");
      setPrimaryResidence(d.primaryResidence || "");
      setExecutorName(d.executorName || "");
      setExecutorPhone(d.executorPhone || "");
      setAltExecutorName(d.altExecutorName || "");
      setAltExecutorPhone(d.altExecutorPhone || "");
      setGuardianName(d.guardianName || "");
      setGuardianPhone(d.guardianPhone || "");
      setAltGuardianName(d.altGuardianName || "");
      setWitnessAcknowledged(Boolean(d.witnessAcknowledged));
      setNotes(d.notes || "");
    })();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/vault/will", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testatorName,
          testatorId,
          primaryResidence,
          executorName,
          executorPhone,
          altExecutorName,
          altExecutorPhone,
          guardianName,
          guardianPhone,
          altGuardianName,
          witnessAcknowledged,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not save");
        return;
      }
      setMessage(
        sw
          ? "Rasimu imehifadhiwa. Wakili atakagua kabla ya kufungwa."
          : "Draft saved. A partner advocate will review this before sealing.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {sw ? "Andika wosia (hatua 5)" : "Will builder (5 steps)"}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {sw
            ? "Hii ni rasimu. Inakuwa wosia halali baada ya sahihi mbele ya mashahidi 2 wasio warithi, na ukaguzi wa wakili."
            : "This is a draft. It becomes a valid written will only after you sign in the presence of 2 adult witnesses who are not beneficiaries, and a partner advocate reviews it."}
        </p>
      </div>
      <PlatformDisclaimer sw={sw} />
      <p className="text-base font-semibold text-forest">
        {sw ? "Hatua" : "Step"} {step} {sw ? "kati ya" : "of"} {STEPS}
      </p>
      <form onSubmit={save} className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        {step === 1 && (
          <>
            <label className="field-label" htmlFor="tn">{sw ? "Jina kamili" : "Full legal name"}</label>
            <input id="tn" className="field" value={testatorName} onChange={(e) => setTestatorName(e.target.value)} />
            <label className="field-label" htmlFor="tid">{sw ? "Nambari ya kitambulisho" : "ID number"}</label>
            <input id="tid" className="field" value={testatorId} onChange={(e) => setTestatorId(e.target.value)} />
            <label className="field-label" htmlFor="pr">{sw ? "Makazi" : "Primary residence"}</label>
            <input id="pr" className="field" value={primaryResidence} onChange={(e) => setPrimaryResidence(e.target.value)} />
          </>
        )}
        {step === 2 && (
          <>
            <label className="field-label" htmlFor="ex">{sw ? "Mtekelezaji" : "Primary executor"}</label>
            <input id="ex" className="field" value={executorName} onChange={(e) => setExecutorName(e.target.value)} />
            <label className="field-label" htmlFor="exp">{sw ? "Simu ya mtekelezaji" : "Executor phone"}</label>
            <input id="exp" className="field" value={executorPhone} onChange={(e) => setExecutorPhone(e.target.value)} />
            <label className="field-label" htmlFor="ax">{sw ? "Mtekelezaji mbadala" : "Alternative executor"}</label>
            <input id="ax" className="field" value={altExecutorName} onChange={(e) => setAltExecutorName(e.target.value)} />
            <input className="field" placeholder={sw ? "Simu" : "Phone"} value={altExecutorPhone} onChange={(e) => setAltExecutorPhone(e.target.value)} />
          </>
        )}
        {step === 3 && (
          <p className="text-lg text-ink">
            {sw
              ? "Gawa mali kwenye ukurasa wa Warithi. Rudia hapa baada ya kugawa."
              : "Assign plots and percentages on the Heirs page. Return here after you save allocations."}{" "}
            <Link href="/vault/heirs" className="font-semibold text-forest underline">
              {sw ? "Fungua warithi" : "Open heirs"}
            </Link>
          </p>
        )}
        {step === 4 && (
          <>
            <label className="field-label" htmlFor="g">{sw ? "Mlezi wa watoto" : "Guardian for minors"}</label>
            <input id="g" className="field" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
            <input className="field" placeholder={sw ? "Simu" : "Phone"} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
            <label className="field-label" htmlFor="ag">{sw ? "Mlezi mbadala" : "Alternative guardian"}</label>
            <input id="ag" className="field" value={altGuardianName} onChange={(e) => setAltGuardianName(e.target.value)} />
          </>
        )}
        {step === 5 && (
          <>
            <label className="flex items-start gap-3 text-base">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5"
                checked={witnessAcknowledged}
                onChange={(e) => setWitnessAcknowledged(e.target.checked)}
              />
              <span>
                {sw
                  ? "Nitaweka sahihi mbele ya mashahidi 2 wazima ambao SI warithi (Kifungu cha 11)."
                  : "I will sign in the presence of 2 adult witnesses who are NOT beneficiaries (Section 11)."}
              </span>
            </label>
            <label className="field-label" htmlFor="n">{sw ? "Maelezo kwa wakili" : "Notes for the advocate"}</label>
            <textarea id="n" className="field min-h-[6rem]" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </>
        )}
        {error && <p className="text-[var(--danger)]">{error}</p>}
        {message && <p className="font-semibold text-forest">{message}</p>}
        <div className="flex flex-wrap gap-3">
          {step > 1 && (
            <button type="button" className="btn btn-secondary-dark" onClick={() => setStep(step - 1)}>
              {sw ? "Rudi" : "Back"}
            </button>
          )}
          {step < STEPS && (
            <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
              {sw ? "Endelea" : "Continue"}
            </button>
          )}
          <button type="submit" className="btn btn-brass" disabled={loading}>
            {loading ? "…" : sw ? "Hifadhi rasimu" : "Save draft"}
          </button>
          <Link href="/vault/review" className="btn btn-secondary-dark">
            {sw ? "Wasilisha kwa wakili" : "Submit for advocate"}
          </Link>
        </div>
      </form>
    </div>
  );
}
