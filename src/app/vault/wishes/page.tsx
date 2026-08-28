"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PlatformDisclaimer } from "@/components/platform-disclaimer";
import { useLocale } from "@/components/locale-provider";

export default function BurialWishesPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";
  const [burialLocation, setBurialLocation] = useState<
    "ancestral" | "cemetery" | "undecided"
  >("ancestral");
  const [burialDetails, setBurialDetails] = useState("");
  const [committeeLead1, setCommitteeLead1] = useState("");
  const [committeeLead2, setCommitteeLead2] = useState("");
  const [specialMessage, setSpecialMessage] = useState("");
  const [burialPlotTitle, setBurialPlotTitle] = useState("");
  const [burialGpsLat, setBurialGpsLat] = useState("");
  const [burialGpsLng, setBurialGpsLng] = useState("");
  const [clanEldersToInvolve, setClanEldersToInvolve] = useState("");
  const [culturalTraditions, setCulturalTraditions] = useState("");
  const [saccoNomineeName, setSaccoNomineeName] = useState("");
  const [saccoNomineePhone, setSaccoNomineePhone] = useState("");
  const [saccoAccount, setSaccoAccount] = useState("");
  const [mpesaNomineePhone, setMpesaNomineePhone] = useState("");
  const [insurancePolicyRef, setInsurancePolicyRef] = useState("");
  const [liquidityNotes, setLiquidityNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/vault/wishes");
      const json = await res.json();
      const w = json.wishes;
      if (!w) return;
      setBurialLocation(w.burialLocation || "ancestral");
      setBurialDetails(w.burialDetails || "");
      setCommitteeLead1(w.committeeLead1 || "");
      setCommitteeLead2(w.committeeLead2 || "");
      setSpecialMessage(w.specialMessage || "");
      setBurialPlotTitle(w.burialPlotTitle || "");
      setBurialGpsLat(w.burialGpsLat != null ? String(w.burialGpsLat) : "");
      setBurialGpsLng(w.burialGpsLng != null ? String(w.burialGpsLng) : "");
      setClanEldersToInvolve(w.clanEldersToInvolve || "");
      setCulturalTraditions(w.culturalTraditions || "");
      setSaccoNomineeName(w.saccoNomineeName || "");
      setSaccoNomineePhone(w.saccoNomineePhone || "");
      setSaccoAccount(w.saccoAccount || "");
      setMpesaNomineePhone(w.mpesaNomineePhone || "");
      setInsurancePolicyRef(w.insurancePolicyRef || "");
      setLiquidityNotes(w.liquidityNotes || "");
    })();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/vault/wishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          burialLocation,
          burialDetails,
          committeeLead1,
          committeeLead2,
          specialMessage,
          burialPlotTitle,
          burialGpsLat: burialGpsLat.trim() ? Number(burialGpsLat) : null,
          burialGpsLng: burialGpsLng.trim() ? Number(burialGpsLng) : null,
          clanEldersToInvolve,
          culturalTraditions,
          saccoNomineeName,
          saccoNomineePhone,
          saccoAccount,
          mpesaNomineePhone,
          insurancePolicyRef,
          liquidityNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not save");
        return;
      }
      setMessage(sw ? "Matakwa yamehifadhiwa." : "Wishes saved in your vault.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {sw ? "Siku 30 za kwanza — mazishi na ukwasi" : "First 30 Days — burial & liquidity"}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {sw
            ? "Maelekezo ya mazishi, kiwanja cha kaburi, na wagombea wa SACCO/M-Pesa walioteuliwa kabla akaunti hazijazuiwa."
            : "Funeral instructions, burial-plot coordinates, and pre-allocated SACCO / M-Pesa nominees so burial costs are not frozen in probate."}
        </p>
      </div>
      <PlatformDisclaimer sw={sw} />
      <form onSubmit={save} className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <label className="field-label" htmlFor="loc">{sw ? "Mahali pa kuzikwa" : "Burial location"}</label>
        <select
          id="loc"
          className="field"
          value={burialLocation}
          onChange={(e) =>
            setBurialLocation(e.target.value as "ancestral" | "cemetery" | "undecided")
          }
        >
          <option value="ancestral">{sw ? "Nyumbani / mashinani" : "Ancestral home (mashinani)"}</option>
          <option value="cemetery">{sw ? "Makaburi" : "Designated cemetery"}</option>
          <option value="undecided">{sw ? "Bado sijachagua" : "Not decided yet"}</option>
        </select>
        <label className="field-label" htmlFor="det">{sw ? "Maelezo ya kiwanja / kaburi" : "Plot or cemetery details"}</label>
        <textarea id="det" className="field min-h-[5rem]" value={burialDetails} onChange={(e) => setBurialDetails(e.target.value)} />
        <label className="field-label" htmlFor="c1">{sw ? "Kiongozi wa kamati 1" : "Funeral committee lead 1"}</label>
        <input id="c1" className="field" value={committeeLead1} onChange={(e) => setCommitteeLead1(e.target.value)} />
        <label className="field-label" htmlFor="c2">{sw ? "Kiongozi wa kamati 2" : "Funeral committee lead 2"}</label>
        <input id="c2" className="field" value={committeeLead2} onChange={(e) => setCommitteeLead2(e.target.value)} />
        <label className="field-label" htmlFor="msg">{sw ? "Ujumbe kwa familia" : "Special message for children"}</label>
        <textarea id="msg" className="field min-h-[6rem]" value={specialMessage} onChange={(e) => setSpecialMessage(e.target.value)} />
        <h2 className="pt-4 text-xl font-semibold text-forest-deep">
          {sw ? "Maelekezo ya kimila" : "Customary burial directives"}
        </h2>
        <label className="field-label" htmlFor="plot">{sw ? "Hati / kiwanja cha kaburi" : "Burial plot title / LR"}</label>
        <input id="plot" className="field" value={burialPlotTitle} onChange={(e) => setBurialPlotTitle(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="lat">{sw ? "GPS lat" : "Burial GPS latitude"}</label>
            <input id="lat" className="field" value={burialGpsLat} onChange={(e) => setBurialGpsLat(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="lng">{sw ? "GPS lng" : "Burial GPS longitude"}</label>
            <input id="lng" className="field" value={burialGpsLng} onChange={(e) => setBurialGpsLng(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="clan">{sw ? "Wazee wa ukoo wa kuhusishwa" : "Clan elders to involve"}</label>
        <textarea id="clan" className="field min-h-[4rem]" value={clanEldersToInvolve} onChange={(e) => setClanEldersToInvolve(e.target.value)} />
        <label className="field-label" htmlFor="trad">{sw ? "Desturi za kufuata" : "Cultural traditions"}</label>
        <textarea id="trad" className="field min-h-[4rem]" value={culturalTraditions} onChange={(e) => setCulturalTraditions(e.target.value)} />
        <h2 className="pt-4 text-xl font-semibold text-forest-deep">
          {sw ? "Ukwasi wa haraka (SACCO / M-Pesa)" : "Immediate liquidity (SACCO / M-Pesa)"}
        </h2>
        <p className="text-base text-muted">
          {sw
            ? "Hii ni maelekezo ya awali — si malipo hai. Husaidia familia kuepuka kufungwa kwa akaunti katika probate."
            : "These are standing nominee instructions, not a live SACCO claim. They help the family avoid probate freezes on burial money."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="sn">{sw ? "Jina la mteule wa SACCO" : "SACCO nominee name"}</label>
            <input id="sn" className="field" value={saccoNomineeName} onChange={(e) => setSaccoNomineeName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="sp">{sw ? "Simu ya mteule" : "Nominee phone"}</label>
            <input id="sp" className="field" value={saccoNomineePhone} onChange={(e) => setSaccoNomineePhone(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="sa">{sw ? "Akaunti ya SACCO" : "SACCO account / member no."}</label>
            <input id="sa" className="field" value={saccoAccount} onChange={(e) => setSaccoAccount(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="mp">{sw ? "M-Pesa ya mazishi" : "M-Pesa number for burial costs"}</label>
            <input id="mp" className="field" value={mpesaNomineePhone} onChange={(e) => setMpesaNomineePhone(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="ins">{sw ? "Polisi ya bima / marejeleo" : "Life insurance / policy ref"}</label>
        <input id="ins" className="field" value={insurancePolicyRef} onChange={(e) => setInsurancePolicyRef(e.target.value)} />
        <label className="field-label" htmlFor="liq">{sw ? "Maelezo ya ukwasi" : "How this money should be used"}</label>
        <textarea id="liq" className="field min-h-[4rem]" value={liquidityNotes} onChange={(e) => setLiquidityNotes(e.target.value)} />
        {error && <p className="text-[var(--danger)]">{error}</p>}
        {message && <p className="font-semibold text-forest">{message}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "…" : sw ? "Hifadhi" : "Save wishes"}
        </button>
      </form>
    </div>
  );
}
