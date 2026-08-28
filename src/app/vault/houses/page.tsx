"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { PlatformDisclaimer } from "@/components/platform-disclaimer";
import { useLocale } from "@/components/locale-provider";
import type { Asset, Beneficiary, HouseholdHouse } from "@/lib/db/types";

export default function HousesWizardPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";
  const [houses, setHouses] = useState<HouseholdHouse[]>([]);
  const [heirs, setHeirs] = useState<Beneficiary[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [houseLabel, setHouseLabel] = useState("");
  const [wifeName, setWifeName] = useState("");
  const [notes, setNotes] = useState("");
  const [allocated, setAllocated] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/vault/houses");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not load");
      return;
    }
    setHouses(json.houses || []);
    setHeirs(json.heirs || []);
    setAssets(json.assets || []);
  }

  useEffect(() => {
    void load();
  }, []);

  function reset() {
    setEditingId(null);
    setHouseLabel("");
    setWifeName("");
    setNotes("");
    setAllocated([]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch("/api/vault/houses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingId || undefined,
        houseLabel,
        wifeName,
        notes,
        allocatedAssetIds: allocated,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not save house");
      return;
    }
    setMessage(
      sw
        ? "Nyumba imehifadhiwa chini ya Kifungu cha 40."
        : "House saved under Section 40 of the Law of Succession Act.",
    );
    reset();
    await load();
  }

  async function remove(id: string) {
    if (!confirm(sw ? "Futa nyumba hii?" : "Remove this house?")) return;
    const res = await fetch("/api/vault/houses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "Could not delete");
      return;
    }
    await load();
  }

  function startEdit(h: HouseholdHouse) {
    setEditingId(h.id);
    setHouseLabel(h.houseLabel);
    setWifeName(h.wifeName);
    setNotes(h.notes);
    setAllocated(h.allocatedAssetIds || []);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {sw ? "Nyumba za wake wengi (Kifungu 40)" : "Polygamous houses (Section 40)"}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {sw
            ? "Gawanya mali wazi kwa kila nyumba — familia ya mke wa kwanza, ya pili — ili mgawanyo wa kisheria usiwe fujo."
            : "Segregate assets per house (first wife's family, second wife's family) so statutory division stays fair and clear."}
        </p>
        <p className="mt-2 text-base text-muted">
          {sw ? "Weka watoto kwenye nyumba kutoka" : "Assign children to a house from"}{" "}
          <Link href="/vault/heirs" className="font-semibold text-forest underline">
            {sw ? "Warithi" : "Heirs"}
          </Link>
          .{" "}
          {sw
            ? "Watoto chini ya miaka 18 hupata amana ya wosia kiotomatiki."
            : "Minors automatically receive testamentary-trust protection in the will draft."}
        </p>
      </div>
      <PlatformDisclaimer sw={sw} />
      {error && <p className="text-[var(--danger)]">{error}</p>}
      {message && <p className="font-semibold text-forest">{message}</p>}

      <form
        onSubmit={save}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {editingId ? (sw ? "Hariri nyumba" : "Edit house") : sw ? "Ongeza nyumba" : "Add a house"}
        </h2>
        <label className="field-label" htmlFor="hl">{sw ? "Jina la nyumba" : "House label"}</label>
        <input
          id="hl"
          className="field"
          required
          placeholder={sw ? "mf. Nyumba ya kwanza" : "e.g. First house — Wanjiku"}
          value={houseLabel}
          onChange={(e) => setHouseLabel(e.target.value)}
        />
        <label className="field-label" htmlFor="wn">{sw ? "Jina la mke / mama" : "Wife / mother of this house"}</label>
        <input id="wn" className="field" value={wifeName} onChange={(e) => setWifeName(e.target.value)} />
        <label className="field-label" htmlFor="nt">{sw ? "Maelezo" : "Notes for the advocate"}</label>
        <textarea id="nt" className="field min-h-[4rem]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        {assets.length > 0 && (
          <fieldset>
            <legend className="field-label">{sw ? "Mali ya nyumba hii" : "Assets allocated to this house"}</legend>
            <ul className="mt-2 space-y-2">
              {assets.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-3 text-base">
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={allocated.includes(a.id)}
                      onChange={(e) =>
                        setAllocated((prev) =>
                          e.target.checked
                            ? [...prev, a.id]
                            : prev.filter((id) => id !== a.id),
                        )
                      }
                    />
                    {a.title}
                    {a.titleNumber ? ` · ${a.titleNumber}` : ""}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn btn-primary">
            {editingId ? (sw ? "Hifadhi" : "Save house") : sw ? "Ongeza" : "Add house"}
          </button>
          {editingId && (
            <button type="button" className="btn btn-secondary-dark" onClick={reset}>
              {sw ? "Ghairi" : "Cancel"}
            </button>
          )}
        </div>
      </form>

      <ul className="space-y-4">
        {houses.map((h, idx) => {
          const members = heirs.filter((heir) => heir.houseId === h.id);
          const houseAssets = assets.filter((a) => h.allocatedAssetIds.includes(a.id));
          return (
            <li key={h.id} className="rounded-[0.45rem] border-2 border-border bg-surface p-5">
              <p className="text-sm font-bold uppercase tracking-[0.12em] text-brass">
                {sw ? `Nyumba ${idx + 1}` : `House ${idx + 1}`}
              </p>
              <h3 className="text-2xl font-semibold text-forest-deep">{h.houseLabel}</h3>
              {h.wifeName ? <p className="text-muted">{h.wifeName}</p> : null}
              {h.notes ? <p className="mt-2 text-ink">{h.notes}</p> : null}
              <p className="mt-3 text-base text-muted">
                {sw ? "Warithi" : "Heirs"}:{" "}
                {members.length
                  ? members.map((m) => `${m.fullName}${m.isMinor ? " (minor)" : ""}`).join(", ")
                  : sw
                    ? "bado hawajawekwa — fungua Warithi"
                    : "none assigned yet — open Heirs"}
              </p>
              <p className="mt-1 text-base text-muted">
                {sw ? "Mali" : "Assets"}:{" "}
                {houseAssets.length
                  ? houseAssets.map((a) => a.title).join(", ")
                  : "—"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-secondary-dark" onClick={() => startEdit(h)}>
                  {sw ? "Hariri" : "Edit"}
                </button>
                <button type="button" className="btn btn-secondary-dark" onClick={() => void remove(h.id)}>
                  {sw ? "Futa" : "Remove"}
                </button>
              </div>
            </li>
          );
        })}
        {houses.length === 0 && (
          <li className="text-muted">
            {sw
              ? "Hakuna nyumba bado. Ongeza nyumba ya kwanza ikiwa kuna wake zaidi ya mmoja."
              : "No houses yet. Add a first house if the household is polygamous."}
          </li>
        )}
      </ul>
    </div>
  );
}
