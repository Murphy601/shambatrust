"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { formatPhoneDisplay } from "@/lib/auth/phone";
import { vaultCopy } from "@/lib/vault-copy";
import type { Allocation, Asset, Beneficiary, HouseholdHouse } from "@/lib/db/types";
import { unallocatedCloseHeirs } from "@/lib/legal/heirs";

export default function HeirsPage() {
  const { locale } = useLocale();
  const t = vaultCopy(locale);
  const sw = locale === "sw";
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [locked, setLocked] = useState(false);
  const [amendmentOpen, setAmendmentOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [houseId, setHouseId] = useState("");
  const [houses, setHouses] = useState<HouseholdHouse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showNextCtas, setShowNextCtas] = useState(false);

  async function load() {
    const [bRes, aRes, alRes] = await Promise.all([
      fetch("/api/vault/beneficiaries"),
      fetch("/api/vault/assets"),
      fetch("/api/vault/allocations"),
    ]);
    const bData = await bRes.json();
    const aData = await aRes.json();
    const alData = await alRes.json();
    if (bRes.ok) {
      setBeneficiaries(bData.beneficiaries);
      setHouses(bData.houses || []);
      setLocked(Boolean(bData.locked));
      setAmendmentOpen(Boolean(bData.amendmentOpen));
    }
    if (aRes.ok) setAssets(aData.assets);
    if (alRes.ok) setAllocations(alData.allocations);
  }

  useEffect(() => {
    void load();
  }, []);

  const percentMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of allocations) {
      if (row.percentage != null && !row.assetId) {
        map.set(row.beneficiaryId, row.percentage);
      }
    }
    return map;
  }, [allocations]);

  const [draftPercents, setDraftPercents] = useState<Record<string, string>>({});
  /** Draft plot picks — saved only via Save allocations */
  const [draftPlots, setDraftPlots] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextPct: Record<string, string> = {};
    const nextPlot: Record<string, string> = {};
    for (const b of beneficiaries) {
      nextPct[b.id] = String(percentMap.get(b.id) ?? "");
      const gift = allocations.find((a) => a.beneficiaryId === b.id && a.assetId);
      nextPlot[b.id] = gift?.assetId || "";
    }
    setDraftPercents(nextPct);
    setDraftPlots(nextPlot);
  }, [beneficiaries, percentMap, allocations]);

  function resetForm() {
    setEditingId(null);
    setFullName("");
    setIdNumber("");
    setPhone("");
    setRelationship("");
    setDateOfBirth("");
    setHouseId("");
  }

  function startEdit(b: Beneficiary) {
    setEditingId(b.id);
    setFullName(b.fullName);
    setIdNumber(b.idNumber);
    setPhone(b.phone);
    setRelationship(b.relationship);
    setDateOfBirth(b.dateOfBirth || "");
    setHouseId(b.houseId || "");
    setShowNextCtas(false);
    setError(null);
    setWarning(null);
    setMessage(null);
  }

  async function saveHeir(event: FormEvent) {
    event.preventDefault();
    if (locked) return;
    setError(null);
    setWarning(null);
    setMessage(null);
    const body = {
      id: editingId || undefined,
      fullName,
      idNumber,
      phone,
      relationship,
      dateOfBirth,
      houseId: houseId || null,
    };
    const res = await fetch("/api/vault/beneficiaries", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save heir");
      return;
    }
    if (data.warning) setWarning(data.warning);
    resetForm();
    setMessage(
      editingId
        ? sw
          ? "Mrithi amesasishwa."
          : "Heir updated."
        : sw
          ? "Mrithi ameongezwa."
          : "Heir added.",
    );
    setShowNextCtas(true);
    await load();
  }

  async function removeHeir(id: string) {
    if (locked) return;
    if (!confirm(sw ? "Futa mrithi?" : "Remove this heir?")) return;
    const res = await fetch(`/api/vault/beneficiaries/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not remove");
      return;
    }
    if (editingId === id) resetForm();
    await load();
  }

  async function saveAllocations() {
    if (locked) return;
    setError(null);
    setMessage(null);
    const rows: Array<{
      beneficiaryId: string;
      assetId: string | null;
      percentage: number | null;
      specificGift: string;
    }> = [];

    for (const b of beneficiaries) {
      const pct = draftPercents[b.id] ? Number(draftPercents[b.id]) : null;
      if (pct != null && !Number.isNaN(pct)) {
        rows.push({
          beneficiaryId: b.id,
          assetId: null,
          percentage: pct,
          specificGift: "",
        });
      }
      const plotId = draftPlots[b.id];
      if (plotId) {
        rows.push({
          beneficiaryId: b.id,
          assetId: plotId,
          percentage: null,
          specificGift: "",
        });
      }
    }

    // Keep any non-asset specific gifts that aren't covered by plot drafts
    for (const a of allocations) {
      if (a.assetId) continue;
      if (a.percentage != null) continue;
      if (!a.specificGift) continue;
      rows.push({
        beneficiaryId: a.beneficiaryId,
        assetId: null,
        percentage: null,
        specificGift: a.specificGift,
      });
    }

    const res = await fetch("/api/vault/allocations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocations: rows }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not save allocations");
      return;
    }
    setMessage(sw ? "Ugawaji umehifadhiwa." : "Allocations saved.");
    setShowNextCtas(true);
    await load();
  }

  function allocationLabel(a: Allocation) {
    const assetTitle = a.assetId
      ? assets.find((x) => x.id === a.assetId)?.title
      : null;
    if (assetTitle) return assetTitle;
    if (a.specificGift) return a.specificGift;
    if (a.percentage != null) return `${a.percentage}%`;
    return "—";
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">{t.heirs}</h1>
        <p className="mt-2 text-lg text-muted">
          {sw
            ? "Taja warithi, kisha ugawaji — hifadhi kwa makusudi (si otomatiki)."
            : "Name heirs, then allocate — save on purpose (nothing auto-saves)."}
        </p>
        <p className="mt-2 text-base font-medium text-forest">
          {locked
            ? t.submittedBanner
            : amendmentOpen
              ? t.amendmentBanner
              : t.draftBanner}
        </p>
      </div>

      {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
      {warning && <p className="text-base font-medium text-brass">{warning}</p>}
      {message && <p className="text-base font-medium text-forest">{message}</p>}
      {unallocatedCloseHeirs(beneficiaries, allocations).length > 0 && (
        <p className="rounded-[0.35rem] border-2 border-brass bg-[#fff8e8] px-4 py-3 text-base text-ink">
          {sw
            ? "Mke/mume au mtoto hana mgao. Andika sababu fupi kwenye wosia ili mahakama isibatilishe."
            : "A spouse or child has no gift yet. Add a short factual reason in the Will builder so a court is less likely to overturn it."}{" "}
          <Link href="/vault/will" className="font-semibold text-forest underline">
            {sw ? "Fungua wosia" : "Open Will builder"}
          </Link>
        </p>
      )}

      {!locked && (
        <form
          onSubmit={saveHeir}
          className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          <h2 className="text-2xl font-semibold text-forest-deep">
            {editingId ? (sw ? "Hariri mrithi" : "Edit heir") : t.addHeir}
          </h2>
          <div>
            <label className="field-label" htmlFor="fullName">
              {sw ? "Jina kamili" : "Full name"}
            </label>
            <input
              id="fullName"
              className="field"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="idNumber">
                {sw ? "Nambari ya kitambulisho" : "ID number"}
              </label>
              <input
                id="idNumber"
                className="field"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="phone">
                {sw ? "Simu" : "Phone"}
              </label>
              <input
                id="phone"
                className="field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
              />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="relationship">
              {sw ? "Uhusiano" : "Relationship"}
            </label>
            <input
              id="relationship"
              className="field"
              required
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder={sw ? "mf. Mwana" : "e.g. Son / Daughter"}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="dob">
                {sw ? "Tarehe ya kuzaliwa" : "Date of birth"}
              </label>
              <input
                id="dob"
                type="date"
                className="field"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
              <p className="mt-1 text-sm text-muted">
                {sw
                  ? "Chini ya miaka 18: amana ya wosia huwekwa kiotomatiki."
                  : "Under 18: a testamentary trust is injected into the will automatically."}
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="house">
                {sw ? "Nyumba (Kifungu 40)" : "House (Section 40)"}
              </label>
              <select
                id="house"
                className="field"
                value={houseId}
                onChange={(e) => setHouseId(e.target.value)}
              >
                <option value="">{sw ? "— Hakuna —" : "— None —"}</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.houseLabel}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-muted">
                <Link href="/vault/houses" className="font-semibold text-forest underline">
                  {sw ? "Simamia nyumba" : "Manage houses"}
                </Link>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn btn-primary">
              {editingId ? t.save : t.addHeir}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn btn-secondary-dark"
                onClick={resetForm}
              >
                {sw ? "Ghairi" : "Cancel"}
              </button>
            )}
          </div>
        </form>
      )}

      {showNextCtas && !locked && beneficiaries.length > 0 && (
        <div className="flex flex-wrap gap-3 rounded-[0.45rem] border-2 border-forest bg-surface p-5">
          <button
            type="button"
            className="btn btn-secondary-dark"
            onClick={() => {
              resetForm();
              setShowNextCtas(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {t.addAnotherHeir}
          </button>
          <Link href="#allocate" className="btn btn-primary">
            {t.continueAllocate}
          </Link>
        </div>
      )}

      {beneficiaries.length === 0 ? (
        <p className="text-lg text-muted">{t.emptyHeirs}</p>
      ) : (
        <section id="allocate" className="space-y-4">
          <h2 className="text-2xl font-semibold text-forest-deep">
            {sw ? "Ugawaji" : "Allocate"}
          </h2>
          {beneficiaries.map((b) => (
            <article
              key={b.id}
              className="rounded-[0.45rem] border-2 border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-2xl font-semibold text-forest-deep">
                    {b.fullName}
                    {b.isMinor ? (
                      <span className="ml-2 text-base font-semibold text-brass">
                        {sw ? "mtoto" : "minor"}
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-base text-muted">
                    {b.relationship}
                    {b.dateOfBirth ? ` · ${b.dateOfBirth}` : ""}
                    {b.houseId
                      ? ` · ${houses.find((h) => h.id === b.houseId)?.houseLabel || "house"}`
                      : ""}
                    {b.idNumber ? ` · ID ${b.idNumber}` : ""}
                    {b.phone ? ` · ${formatPhoneDisplay(b.phone)}` : ""}
                  </p>
                </div>
                {!locked && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary-dark"
                      onClick={() => startEdit(b)}
                    >
                      {sw ? "Hariri" : "Edit"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary-dark"
                      onClick={() => void removeHeir(b.id)}
                    >
                      {t.delete}
                    </button>
                  </div>
                )}
              </div>
              {!locked && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end">
                  <div>
                    <label className="field-label" htmlFor={`pct-${b.id}`}>
                      {sw ? "Asilimia ya urithi" : "Inheritance share %"}
                    </label>
                    <input
                      id={`pct-${b.id}`}
                      className="field"
                      inputMode="decimal"
                      value={draftPercents[b.id] || ""}
                      onChange={(e) =>
                        setDraftPercents((prev) => ({
                          ...prev,
                          [b.id]: e.target.value,
                        }))
                      }
                    />
                  </div>
                  {assets.length > 0 && (
                    <div>
                      <label className="field-label" htmlFor={`plot-${b.id}`}>
                        {sw ? "Teua shamba / mali" : "Assign specific asset"}
                      </label>
                      <select
                        id={`plot-${b.id}`}
                        className="field"
                        value={draftPlots[b.id] || ""}
                        onChange={(e) =>
                          setDraftPlots((prev) => ({
                            ...prev,
                            [b.id]: e.target.value,
                          }))
                        }
                      >
                        <option value="">—</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              <ul className="mt-3 space-y-1 text-base text-muted">
                {allocations
                  .filter((a) => a.beneficiaryId === b.id)
                  .map((a) => (
                    <li key={a.id}>
                      {a.assetId
                        ? sw
                          ? `Zawadi: ${allocationLabel(a)}`
                          : `Gift: ${allocationLabel(a)}`
                        : a.percentage != null
                          ? `${a.percentage}%`
                          : allocationLabel(a)}
                    </li>
                  ))}
              </ul>
            </article>
          ))}
          {!locked && (
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveAllocations()}
              >
                {sw ? "Hifadhi ugawaji" : "Save allocations"}
              </button>
              {allocations.length > 0 && (
                <Link href="/vault/review" className="btn btn-brass">
                  {t.continueReview}
                </Link>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
