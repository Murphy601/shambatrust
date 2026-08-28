"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";
import { vaultCopy } from "@/lib/vault-copy";
import { isLandLike, uploadLabel } from "@/lib/asset-fields";
import { KENYA_COUNTIES } from "@/lib/kenya-counties";
import type { AssetType } from "@/lib/db/types";

const TYPES: AssetType[] = [
  "land",
  "commercial_plot",
  "business",
  "vehicle",
  "bank_account",
  "sacco",
  "other",
];

type NomineeDraft = {
  fullName: string;
  idNumber: string;
  phone: string;
  relationship: string;
  percentage: string;
};

const emptyNominee = (): NomineeDraft => ({
  fullName: "",
  idNumber: "",
  phone: "",
  relationship: "",
  percentage: "",
});

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
  const [disputeFlag, setDisputeFlag] = useState(false);
  const [disputeNotes, setDisputeNotes] = useState("");
  const [familyAlert, setFamilyAlert] = useState(false);
  const [parcelNumber, setParcelNumber] = useState("");
  const [blockNumber, setBlockNumber] = useState("");
  const [registrationSection, setRegistrationSection] = useState("");
  const [landRegistryOffice, setLandRegistryOffice] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [year, setYear] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("");
  const [businessRegNumber, setBusinessRegNumber] = useState("");
  const [kraPin, setKraPin] = useState("");
  const [saccoName, setSaccoName] = useState("");
  const [saccoMemberNumber, setSaccoMemberNumber] = useState("");
  const [mpesaNumber, setMpesaNumber] = useState("");
  const [nominees, setNominees] = useState<NomineeDraft[]>([]);
  const [documentName, setDocumentName] = useState<string | null>(null);
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const nomineeTotalPercent = nominees.reduce(
    (sum, nominee) => sum + (Number(nominee.percentage) || 0),
    0,
  );

  function resetForm() {
    setStep(1);
    setTitle("");
    setNotes("");
    setTitleNumber("");
    setCounty("");
    setSubCounty("");
    setLandmark("");
    setGpsLat("");
    setGpsLng("");
    setDisputeFlag(false);
    setDisputeNotes("");
    setFamilyAlert(false);
    setParcelNumber("");
    setBlockNumber("");
    setRegistrationSection("");
    setLandRegistryOffice("");
    setRegistrationNumber("");
    setMakeModel("");
    setYear("");
    setBankName("");
    setAccountNumber("");
    setAccountType("");
    setBusinessRegNumber("");
    setKraPin("");
    setSaccoName("");
    setSaccoMemberNumber("");
    setMpesaNumber("");
    setNominees([]);
    setDocumentName(null);
    setDocumentPath(null);
    setError(null);
  }

  function updateNominee(index: number, patch: Partial<NomineeDraft>) {
    setNominees((current) =>
      current.map((nominee, i) =>
        i === index ? { ...nominee, ...patch } : nominee,
      ),
    );
  }

  function titlePlaceholder() {
    if (isLandLike(type)) return sw ? "mf. Shamba la Nyeri" : "e.g. Nyeri family shamba";
    if (type === "vehicle") return sw ? "mf. Toyota Premio ya baba" : "e.g. Father's Toyota Premio";
    if (type === "bank_account") return sw ? "mf. Akaunti ya Equity" : "e.g. Equity savings account";
    if (type === "business") return sw ? "mf. Duka la Familia" : "e.g. Family shop / company";
    if (type === "sacco") return sw ? "mf. Akaunti ya Stima SACCO" : "e.g. Stima SACCO deposits";
    return sw ? "mf. Maelezo mafupi" : "e.g. Short description";
  }

  function canContinueStep2() {
    if (!title.trim()) return false;
    if (isLandLike(type)) return Boolean(county.trim());
    if (type === "vehicle") return Boolean(registrationNumber.trim());
    if (type === "bank_account") return Boolean(bankName.trim() && accountNumber.trim());
    if (type === "business") return Boolean(businessRegNumber.trim() || kraPin.trim());
    if (type === "sacco") {
      if (!saccoName.trim()) return false;
      if (nominees.length === 0) return true;
      return (
        nominees.every((nominee) => nominee.fullName.trim()) &&
        Math.round(nomineeTotalPercent) === 100
      );
    }
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
          disputeFlag: isLandLike(type) ? disputeFlag : false,
          disputeNotes: isLandLike(type) ? disputeNotes : "",
          familyAlert: isLandLike(type) ? familyAlert : false,
          parcelNumber: isLandLike(type) ? parcelNumber : "",
          blockNumber: isLandLike(type) ? blockNumber : "",
          registrationSection: isLandLike(type) ? registrationSection : "",
          landRegistryOffice: isLandLike(type) ? landRegistryOffice : "",
          registrationNumber: type === "vehicle" ? registrationNumber : "",
          makeModel: type === "vehicle" ? makeModel : "",
          year: type === "vehicle" ? year : "",
          bankName: type === "bank_account" ? bankName : "",
          accountNumber: type === "bank_account" ? accountNumber : "",
          accountType: type === "bank_account" ? accountType : "",
          businessRegNumber: type === "business" ? businessRegNumber : "",
          kraPin: type === "business" ? kraPin : "",
          saccoName: type === "sacco" ? saccoName : "",
          saccoMemberNumber: type === "sacco" ? saccoMemberNumber : "",
          mpesaNumber: type === "sacco" ? mpesaNumber : "",
          saccoNominees:
            type === "sacco"
              ? nominees.map((nominee) => ({
                  fullName: nominee.fullName.trim(),
                  idNumber: nominee.idNumber.trim(),
                  phone: nominee.phone.trim(),
                  relationship: nominee.relationship.trim(),
                  percentage: Number(nominee.percentage) || 0,
                }))
              : [],
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
              resetForm();
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

                <fieldset className="rounded-[0.35rem] border-2 border-border p-4">
                  <legend className="px-2 text-base font-semibold text-forest-deep">
                    {sw
                      ? "Utambulisho wa kiwanja (ArdhiSasa)"
                      : "ArdhiSasa parcel identifiers"}
                  </legend>
                  <p className="text-base text-muted">
                    {sw
                      ? "Nakili haya kutoka kwa hati miliki yako. Wizara haitoi API ya umma — wakili wa LSK atawasilisha utafutaji kwenye akaunti yake ya kitaalamu."
                      : "Copy these from your title deed. The Ministry has no public API — your LSK advocate files the search on their professional ArdhiSasa account."}
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label" htmlFor="parcelNumber">
                        {sw ? "Nambari ya kiwanja" : "Parcel number"}
                      </label>
                      <input
                        id="parcelNumber"
                        className="field"
                        value={parcelNumber}
                        onChange={(e) => setParcelNumber(e.target.value)}
                        placeholder={sw ? "mf. 1234" : "e.g. 1234"}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="blockNumber">
                        {sw ? "Nambari ya block" : "Parcel block number"}
                      </label>
                      <input
                        id="blockNumber"
                        className="field"
                        value={blockNumber}
                        onChange={(e) => setBlockNumber(e.target.value)}
                        placeholder={sw ? "mf. Block 12" : "e.g. Block 12"}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="registrationSection">
                        {sw ? "Sehemu ya usajili" : "Registration section"}
                      </label>
                      <input
                        id="registrationSection"
                        className="field"
                        value={registrationSection}
                        onChange={(e) => setRegistrationSection(e.target.value)}
                        placeholder={sw ? "mf. Ngong" : "e.g. Ngong"}
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="landRegistryOffice">
                        {sw
                          ? "Ofisi ya ardhi ya kaunti"
                          : "County land registry office"}
                      </label>
                      <input
                        id="landRegistryOffice"
                        className="field"
                        list="county-registry-list"
                        value={landRegistryOffice}
                        onChange={(e) => setLandRegistryOffice(e.target.value)}
                        placeholder={sw ? "mf. Kajiado" : "e.g. Kajiado"}
                      />
                      <datalist id="county-registry-list">
                        {KENYA_COUNTIES.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </fieldset>
              </>
            )}

            {type === "sacco" && (
              <>
                <div>
                  <label className="field-label" htmlFor="saccoName">
                    {sw ? "Jina la SACCO" : "SACCO name"}
                  </label>
                  <input
                    id="saccoName"
                    className="field"
                    required
                    value={saccoName}
                    onChange={(e) => setSaccoName(e.target.value)}
                    placeholder={sw ? "mf. Stima SACCO" : "e.g. Stima SACCO"}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="saccoMemberNumber">
                    {sw ? "Nambari ya mwanachama" : "Member / account ID"}
                  </label>
                  <input
                    id="saccoMemberNumber"
                    className="field"
                    value={saccoMemberNumber}
                    onChange={(e) => setSaccoMemberNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="mpesaNumber">
                    {sw
                      ? "Nambari ya M-Pesa iliyounganishwa (si lazima)"
                      : "Linked M-Pesa number (optional)"}
                  </label>
                  <input
                    id="mpesaNumber"
                    className="field"
                    value={mpesaNumber}
                    onChange={(e) => setMpesaNumber(e.target.value)}
                    placeholder="+2547…"
                    inputMode="tel"
                  />
                </div>

                <fieldset className="rounded-[0.35rem] border-2 border-border p-4">
                  <legend className="px-2 text-base font-semibold text-forest-deep">
                    {sw ? "Wateule wa SACCO" : "SACCO nominees"}
                  </legend>
                  <p className="text-base text-muted">
                    {sw
                      ? "Sheria za SACCO hulipa wateule moja kwa moja. Asilimia lazima zifike 100% ili zilingane na wosia wako."
                      : "SACCO bylaws pay nominees directly, outside the estate. Shares must total 100% so they cannot contradict your will."}
                  </p>
                  <ul className="mt-4 space-y-4">
                    {nominees.map((nominee, index) => (
                      <li
                        key={index}
                        className="grid gap-3 rounded-[0.35rem] border border-border p-3 sm:grid-cols-2"
                      >
                        <input
                          className="field"
                          aria-label={sw ? "Jina kamili" : "Nominee full name"}
                          placeholder={sw ? "Jina kamili" : "Full name"}
                          value={nominee.fullName}
                          onChange={(e) =>
                            updateNominee(index, { fullName: e.target.value })
                          }
                          required
                        />
                        <input
                          className="field"
                          aria-label={sw ? "Uhusiano" : "Relationship"}
                          placeholder={sw ? "Uhusiano" : "Relationship"}
                          value={nominee.relationship}
                          onChange={(e) =>
                            updateNominee(index, { relationship: e.target.value })
                          }
                        />
                        <input
                          className="field"
                          aria-label={sw ? "Nambari ya ID" : "ID number"}
                          placeholder={sw ? "Nambari ya ID" : "ID number"}
                          value={nominee.idNumber}
                          onChange={(e) =>
                            updateNominee(index, { idNumber: e.target.value })
                          }
                        />
                        <input
                          className="field"
                          aria-label={sw ? "Simu" : "Phone"}
                          placeholder="+2547…"
                          inputMode="tel"
                          value={nominee.phone}
                          onChange={(e) =>
                            updateNominee(index, { phone: e.target.value })
                          }
                        />
                        <div className="flex gap-2">
                          <input
                            className="field"
                            aria-label={sw ? "Asilimia" : "Percentage"}
                            placeholder="%"
                            inputMode="decimal"
                            type="number"
                            min={0}
                            max={100}
                            value={nominee.percentage}
                            onChange={(e) =>
                              updateNominee(index, { percentage: e.target.value })
                            }
                            required
                          />
                          <button
                            type="button"
                            className="btn btn-secondary-dark"
                            aria-label={sw ? "Ondoa mteule" : "Remove nominee"}
                            onClick={() =>
                              setNominees((current) =>
                                current.filter((_, i) => i !== index),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="btn btn-secondary-dark"
                      onClick={() =>
                        setNominees((current) => [...current, emptyNominee()])
                      }
                    >
                      {sw ? "Ongeza mteule" : "Add nominee"}
                    </button>
                    {nominees.length > 0 && (
                      <p
                        className={`text-base font-semibold ${
                          Math.round(nomineeTotalPercent) === 100
                            ? "text-forest"
                            : "text-[var(--danger)]"
                        }`}
                      >
                        {sw ? "Jumla" : "Total"}: {nomineeTotalPercent}%
                        {Math.round(nomineeTotalPercent) === 100
                          ? " ✓"
                          : sw
                            ? " — lazima iwe 100%"
                            : " — must be 100%"}
                      </p>
                    )}
                  </div>
                </fieldset>
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
              <div className="space-y-4">
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
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="btn btn-secondary-dark"
                    onClick={() => {
                      if (!navigator.geolocation) {
                        setError(
                          sw
                            ? "Kivinjari hiki hakina GPS."
                            : "This browser cannot read GPS.",
                        );
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setGpsLat(String(pos.coords.latitude));
                          setGpsLng(String(pos.coords.longitude));
                        },
                        () =>
                          setError(
                            sw
                              ? "Hatukuweza kupata eneo. Weka namba kwa mkono."
                              : "Could not read location. Enter coordinates manually.",
                          ),
                      );
                    }}
                  >
                    {sw ? "Pini eneo langu" : "Pin my location"}
                  </button>
                  {gpsLat && gpsLng ? (
                    <a
                      className="btn btn-secondary-dark"
                      href={`https://www.google.com/maps?q=${encodeURIComponent(`${gpsLat},${gpsLng}`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {sw ? "Fungua ramani" : "Open in Maps"}
                    </a>
                  ) : null}
                </div>
                <label className="flex items-start gap-3 text-base">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    checked={disputeFlag}
                    onChange={(e) => setDisputeFlag(e.target.checked)}
                  />
                  <span>
                    {sw
                      ? "Kiwanja hiki kiko kwenye mzozo au caveat."
                      : "This parcel is in active dispute or has a caveat."}
                  </span>
                </label>
                <label className="flex items-start gap-3 text-base">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    checked={familyAlert}
                    onChange={(e) => setFamilyAlert(e.target.checked)}
                  />
                  <span>
                    {sw
                      ? "Onyo la familia: kuuzwa/kugawanywa bila ridhaa."
                      : "Family alert: watch for unauthorized sale or subdivision."}
                  </span>
                </label>
                {(disputeFlag || familyAlert) && (
                  <textarea
                    className="field min-h-[5rem]"
                    placeholder={sw ? "Maelezo ya mzozo" : "Dispute / alert notes"}
                    value={disputeNotes}
                    onChange={(e) => setDisputeNotes(e.target.value)}
                  />
                )}
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
