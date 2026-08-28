"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PlatformDisclaimer } from "@/components/platform-disclaimer";
import { useLocale } from "@/components/locale-provider";

export default function TrustWizardPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";
  const [trustName, setTrustName] = useState("");
  const [primaryTrustee, setPrimaryTrustee] = useState("");
  const [coTrustee, setCoTrustee] = useState("");
  const [titleNumbers, setTitleNumbers] = useState("");
  const [conditions, setConditions] = useState("");
  const [enforcerName, setEnforcerName] = useState("");
  const [enforcerPhone, setEnforcerPhone] = useState("");
  const [enforcerIdNumber, setEnforcerIdNumber] = useState("");
  const [enforcerOrganization, setEnforcerOrganization] = useState("");
  const [minCoSignApprovals, setMinCoSignApprovals] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/vault/trust");
      const json = await res.json();
      const d = json.draft;
      if (!d) return;
      setTrustName(d.trustName || "");
      setPrimaryTrustee(d.primaryTrustee || "");
      setCoTrustee(d.coTrustee || "");
      setTitleNumbers(d.titleNumbers || "");
      setConditions(d.conditions || "");
      setEnforcerName(d.enforcerName || "");
      setEnforcerPhone(d.enforcerPhone || "");
      setEnforcerIdNumber(d.enforcerIdNumber || "");
      setEnforcerOrganization(d.enforcerOrganization || "");
      setMinCoSignApprovals(d.minCoSignApprovals || 2);
    })();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/vault/trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trustName,
          primaryTrustee,
          coTrustee,
          titleNumbers,
          conditions,
          enforcerName,
          enforcerPhone,
          enforcerIdNumber,
          enforcerOrganization,
          minCoSignApprovals,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not save");
        return;
      }
      setMessage(
        sw
          ? "Rasimu ya amana imehifadhiwa kwa wakili."
          : "Trust draft saved for your advocate.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {sw ? "Amana ya ardhi ya familia" : "Family land trust"}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {sw
            ? "Weka jina la amana, wateule, na mashamba yatakayoshikiliwa pamoja — ili yasigawanywe kila kizazi."
            : "Name the trust, appoint trustees, and list LR numbers to keep ancestral shambas unified."}
        </p>
      </div>
      <PlatformDisclaimer sw={sw} />
      <form onSubmit={save} className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <label className="field-label" htmlFor="name">{sw ? "Jina la amana" : "Trust name"}</label>
        <input id="name" className="field" placeholder='e.g. The Muiruri Family Land Trust' value={trustName} onChange={(e) => setTrustName(e.target.value)} />
        <label className="field-label" htmlFor="pt">{sw ? "Mteule mkuu" : "Primary trustee"}</label>
        <input id="pt" className="field" value={primaryTrustee} onChange={(e) => setPrimaryTrustee(e.target.value)} />
        <label className="field-label" htmlFor="ct">{sw ? "Mteule mwenza" : "Co-trustee"}</label>
        <input id="ct" className="field" value={coTrustee} onChange={(e) => setCoTrustee(e.target.value)} />
        <label className="field-label" htmlFor="lr">{sw ? "Nambari za hati (LR)" : "Land titles (LR numbers)"}</label>
        <textarea id="lr" className="field min-h-[5rem]" value={titleNumbers} onChange={(e) => setTitleNumbers(e.target.value)} />
        <label className="field-label" htmlFor="cond">{sw ? "Masharti ya ugawaji" : "Distribution conditions"}</label>
        <textarea id="cond" className="field min-h-[6rem]" value={conditions} onChange={(e) => setConditions(e.target.value)} />
        <h2 className="pt-2 text-xl font-semibold text-forest-deep">
          {sw ? "Enforcer (mpatanishi huru)" : "Enforcer (independent mediator)"}
        </h2>
        <p className="text-base text-muted">
          {sw
            ? "Jukumu la lazima kuvunja mkwamo kati ya wateule. Sahihi mbili zinahitajika kabla ya marekebisho."
            : "Mandatory role to break deadlocks between co-trustees. Dual signatures are required before amendments are logged."}
        </p>
        <label className="field-label" htmlFor="en">{sw ? "Jina la Enforcer" : "Enforcer name"}</label>
        <input id="en" className="field" value={enforcerName} onChange={(e) => setEnforcerName(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="field" placeholder={sw ? "Simu" : "Phone"} value={enforcerPhone} onChange={(e) => setEnforcerPhone(e.target.value)} />
          <input className="field" placeholder={sw ? "Nambari ya ID" : "ID number"} value={enforcerIdNumber} onChange={(e) => setEnforcerIdNumber(e.target.value)} />
        </div>
        <input className="field" placeholder={sw ? "Kampuni / LSK" : "Firm / LSK organisation"} value={enforcerOrganization} onChange={(e) => setEnforcerOrganization(e.target.value)} />
        <label className="field-label" htmlFor="cs">{sw ? "Sahihi zinazohitajika" : "Co-signatures required"}</label>
        <input
          id="cs"
          type="number"
          min={2}
          max={5}
          className="field max-w-xs"
          value={minCoSignApprovals}
          onChange={(e) => setMinCoSignApprovals(Number(e.target.value) || 2)}
        />
        {error && <p className="text-[var(--danger)]">{error}</p>}
        {message && <p className="font-semibold text-forest">{message}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "…" : sw ? "Hifadhi rasimu" : "Save draft"}
          </button>
          <Link href="/vault/review" className="btn btn-secondary-dark">
            {sw ? "Omba amana kwa wakili" : "Request trust with advocate"}
          </Link>
        </div>
      </form>
    </div>
  );
}
