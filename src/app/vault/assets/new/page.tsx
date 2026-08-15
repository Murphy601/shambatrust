"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { vaultCopy } from "@/lib/vault-copy";
import { isLandLike, uploadLabel } from "@/lib/asset-fields";
import type { AssetType } from "@/lib/db/types";

const TYPES: AssetType[] = [
  "land",
  "commercial_plot",
  "business",
  "vehicle",
  "bank_account",
  "other",
];

export default function NewAssetPage() {
  const { locale } = useLocale();
  const t = vaultCopy(locale);
  const sw = locale === "sw";

  const [step, setStep] = useState(1);
  const [type, setType] = useState<AssetType>("land");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [titleNumber, setTitleNumber] = useState("");
  const [county, setCounty] = useState("");
  const [subCounty, setSubCounty] = useState("");
  const [landmark, setLandmark] = useState("");
  const [gpsLat, setGpsLat] = useState("");
  const [gpsLng, setGpsLng] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [year, setYear] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("");
  const [businessRegNumber, setBusinessRegNumber] = useState("");
  const [kraPin, setKraPin] = useState("");
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  function titlePlaceholder() {
    if (isLandLike(type)) return sw ? "mf. Shamba la Nyeri" : "e.g. Nyeri family shamba";
    if (type === "vehicle") return sw ? "mf. Toyota Premio ya baba" : "e.g. Father's Toyota Premio";
    if (type === "bank_account") return sw ? "mf. Akaunti ya Equity" : "e.g. Equity savings account";
    if (type === "business") return sw ? "mf. Duka la Familia" : "e.g. Family shop / company";
    return sw ? "mf. Maelezo mafupi" : "e.g. Short description";
  }

  function canContinueStep2() {
    if (!title.trim()) return false;
    if (isLandLike(type)) return Boolean(county.trim());
    if (type === "vehicle") return Boolean(registrationNumber.trim());
    if (type === "bank_account") return Boolean(bankName.trim() && accountNumber.trim());
    if (type === "business") return Boolean(businessRegNumber.trim() || kraPin.trim());
    return true;
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const res = await fetch("/api/vault/upload", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    setDocumentName(data.documentName);
    setDocumentPath(data.documentPath);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vault/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          notes,
          documentName,
          documentPath,
          titleNumber: isLandLike(type) ? titleNumber : "",
          county: isLandLike(type) || type === "business" ? county : "",
          subCounty: isLandLike(type) ? subCounty : "",
          landmark: isLandLike(type) ? landmark : "",
          gpsLat: isLandLike(type) && gpsLat ? Number(gpsLat) : null,
          gpsLng: isLandLike(type) && gpsLng ? Number(gpsLng) : null,
          registrationNumber: type === "vehicle" ? registrationNumber : "",
          makeModel: type === "vehicle" ? makeModel : "",
          year: type === "vehicle" ? year : "",
          bankName: type === "bank_account" ? bankName : "",
          accountNumber: type === "bank_account" ? accountNumber : "",
          accountType: type === "bank_account" ? accountType : "",
          businessRegNumber: type === "business" ? businessRegNumber : "",
          kraPin: type === "business" ? kraPin : "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  if (saved) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-semibold text-forest-deep">
          {sw ? "Mali imehifadhiwa" : "Asset saved"}
        </h1>
        <p className="text-lg text-muted">
          {sw
            ? "Ongeza mali nyingine au endelea kwa warithi."
            : "Add another asset or continue to heirs."}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn btn-secondary-dark"
            onClick={() => {
              setSaved(false);
              setStep(1);
              setTitle("");
              setNotes("");
              setTitleNumber("");
              setCounty("");
              setSubCounty("");
              setLandmark("");
              setGpsLat("");
              setGpsLng("");
              setRegistrationNumber("");
              setMakeModel("");
              setYear("");
              setBankName("");
              setAccountNumber("");
              setAccountType("");
              setBusinessRegNumber("");
              setKraPin("");
              setDocumentName(null);
              setDocumentPath(null);
            }}
          >
            {t.addAnotherAsset}
          </button>
          <Link href="/vault/heirs" className="btn btn-primary">
            {t.continueHeirs}
          </Link>
          <Link href="/vault/assets" className="btn btn-secondary-dark">
            {t.assets}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/vault/assets"
        className="text-base font-semibold text-forest underline-offset-4 hover:underline"
      >
        ← {t.assets}
      </Link>
      <h1 className="text-3xl font-semibold text-forest-deep">{t.addAsset}</h1>
      <p className="text-lg text-muted">
        {sw ? `Hatua ${step} kati ya 3` : `Step ${step} of 3`}
        {step > 1 ? ` · ${t.assetTypes[type]}` : ""}
      </p>

      <form
        onSubmit={save}
        className="space-y-5 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        {step === 1 && (
          <div className="space-y-3">
            <p className="field-label">{sw ? "Aina ya mali" : "Asset type"}</p>
            {TYPES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setType(item)}
                className={`flex min-h-14 w-full items-center rounded-[0.35rem] border-2 px-4 text-left text-lg font-semibold ${
                  type === item
                    ? "border-forest bg-[color-mix(in_srgb,var(--forest)_10%,white)]"
                    : "border-border"
                }`}
              >
                {t.assetTypes[item]}
              </button>
            ))}
            <button type="button" className="btn btn-primary w-full" onClick={() => setStep(2)}>
              {sw ? "Endelea" : "Continue"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="title">
                {isLandLike(type)
                  ? sw
                    ? "Jina la shamba / kiwanja"
                    : "Shamba / plot name"
                  : type === "vehicle"
                    ? sw
                      ? "Jina la gari"
                      : "Vehicle label"
                    : type === "bank_account"
                      ? sw
                        ? "Jina la akaunti"
                        : "Account label"
                      : type === "business"
                        ? sw
                          ? "Jina la biashara"
                          : "Business name"
                        : sw
                          ? "Jina / maelezo"
                          : "Name / description"}
              </label>
              <input
                id="title"
                className="field"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={titlePlaceholder()}
              />
            </div>

            {isLandLike(type) && (
              <>
                <div>
                  <label className="field-label" htmlFor="titleNumber">
                    {sw ? "Nambari ya hati (LR No.)" : "Title number (LR No.)"}
                  </label>
                  <input
                    id="titleNumber"
                    className="field"
                    value={titleNumber}
                    onChange={(e) => setTitleNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="county">
                    {sw ? "Kaunti" : "County"}
                  </label>
                  <input
                    id="county"
                    className="field"
                    required
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="subCounty">
                    {sw ? "Kaunti ndogo" : "Sub-county"}
                  </label>
                  <input
                    id="subCounty"
                    className="field"
                    value={subCounty}
                    onChange={(e) => setSubCounty(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="landmark">
                    {sw ? "Alama ya karibu" : "Nearest landmark"}
                  </label>
                  <input
                    id="landmark"
                    className="field"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                  />
                </div>
              </>
            )}

            {type === "vehicle" && (
              <>
                <div>
                  <label className="field-label" htmlFor="reg">
                    {sw ? "Nambari ya usajili" : "Registration number"}
                  </label>
                  <input
                    id="reg"
                    className="field"
                    required
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="e.g. KDA 123A"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="make">
                    {sw ? "Aina / modeli" : "Make & model"}
                  </label>
                  <input
                    id="make"
                    className="field"
                    value={makeModel}
                    onChange={(e) => setMakeModel(e.target.value)}
                    placeholder="e.g. Toyota Premio"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="year">
                    {sw ? "Mwaka" : "Year"}
                  </label>
                  <input
                    id="year"
                    className="field"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="e.g. 2018"
                    inputMode="numeric"
                  />
                </div>
              </>
            )}

            {type === "bank_account" && (
              <>
                <div>
                  <label className="field-label" htmlFor="bank">
                    {sw ? "Jina la benki" : "Bank name"}
                  </label>
                  <input
                    id="bank"
                    className="field"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Equity / KCB / Co-op"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="accType">
                    {sw ? "Aina ya akaunti" : "Account type"}
                  </label>
                  <input
                    id="accType"
                    className="field"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    placeholder={sw ? "mf. Savings / Current" : "e.g. Savings / Current"}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="accNo">
                    {sw ? "Nambari ya akaunti" : "Account number"}
                  </label>
                  <input
                    id="accNo"
                    className="field"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
              </>
            )}

            {type === "business" && (
              <>
                <div>
                  <label className="field-label" htmlFor="bizReg">
                    {sw ? "Nambari ya usajili wa biashara" : "Business registration number"}
                  </label>
                  <input
                    id="bizReg"
                    className="field"
                    value={businessRegNumber}
                    onChange={(e) => setBusinessRegNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="kra">
                    KRA PIN
                  </label>
                  <input
                    id="kra"
                    className="field"
                    value={kraPin}
                    onChange={(e) => setKraPin(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="bizCounty">
                    {sw ? "Kaunti (si lazima)" : "County (optional)"}
                  </label>
                  <input
                    id="bizCounty"
                    className="field"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                  />
                </div>
              </>
            )}

            {type === "other" && (
              <p className="text-base text-muted">
                {sw
                  ? "Eleza mali hii kwa ufupi. Unaweza kuongeza hati katika hatua inayofuata."
                  : "Describe this asset briefly. You can attach a document in the next step."}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-secondary-dark flex-1"
                onClick={() => setStep(1)}
              >
                {sw ? "Rudi" : "Back"}
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={() => setStep(3)}
                disabled={!canContinueStep2()}
              >
                {sw ? "Endelea" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="doc">
                {uploadLabel(type, locale)}
              </label>
              <input
                id="doc"
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                className="field"
                onChange={(e) => void onUpload(e.target.files?.[0] || null)}
              />
              {documentName && (
                <p className="mt-2 text-base font-semibold text-forest">{documentName}</p>
              )}
            </div>

            {isLandLike(type) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="lat">
                    GPS latitude ({sw ? "si lazima" : "optional"})
                  </label>
                  <input
                    id="lat"
                    className="field"
                    value={gpsLat}
                    onChange={(e) => setGpsLat(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="lng">
                    GPS longitude ({sw ? "si lazima" : "optional"})
                  </label>
                  <input
                    id="lng"
                    className="field"
                    value={gpsLng}
                    onChange={(e) => setGpsLng(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="notes">
                {sw ? "Maelezo zaidi" : "Notes"}
              </label>
              <textarea
                id="notes"
                className="field min-h-[6rem]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && (
              <p className="text-base font-medium text-[var(--danger)]">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-secondary-dark flex-1"
                onClick={() => setStep(2)}
              >
                {sw ? "Rudi" : "Back"}
              </button>
              <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                {loading ? "…" : t.save}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
