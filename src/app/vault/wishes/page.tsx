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
          {sw ? "Matakwa ya mazishi" : "Legacy & burial wishes"}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {sw
            ? "Si lazima. Familia itaziona wakati wa kufungua hifadhi."
            : "Optional. These instructions sit with your vault until succession is activated."}
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
        {error && <p className="text-[var(--danger)]">{error}</p>}
        {message && <p className="font-semibold text-forest">{message}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "…" : sw ? "Hifadhi" : "Save wishes"}
        </button>
      </form>
    </div>
  );
}
