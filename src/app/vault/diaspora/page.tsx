"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { PlatformDisclaimer } from "@/components/platform-disclaimer";
import { useLocale } from "@/components/locale-provider";
import { CHECKOUT_DEFAULTS_KES, fromKes } from "@/lib/payments/fx";
import { isLandLike } from "@/lib/asset-fields";
import {
  ARDHISASA_NOTICE_EN,
  ARDHISASA_NOTICE_SW,
  ardhisasaStatusLabel,
  consentPathLabel,
  lookupParcelSummary,
} from "@/lib/land-registry/verification";
import type {
  Asset,
  CheckoutCurrency,
  CheckoutKind,
  ConsultBooking,
  PaymentCheckout,
  TitleLookupRecord,
} from "@/lib/db/types";

type AdvocateOpt = {
  id: string;
  fullName: string;
  county: string;
  advocateLicense: string | null;
};

type HeirOpt = {
  id: string;
  fullName: string;
  phone: string;
  relationship: string;
};

export default function DiasporaBridgePage() {
  const { locale } = useLocale();
  const sw = locale === "sw";
  const [diasporaNationalId, setDiasporaNationalId] = useState("");
  const [ecitizenId, setEcitizenId] = useState("");
  const [ardhiSasaId, setArdhiSasaId] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [passportCountry, setPassportCountry] = useState("");
  const [countryOfResidence, setCountryOfResidence] = useState("");
  const [isDiaspora, setIsDiaspora] = useState(false);
  const [advocates, setAdvocates] = useState<AdvocateOpt[]>([]);
  const [bookings, setBookings] = useState<ConsultBooking[]>([]);
  const [checkouts, setCheckouts] = useState<PaymentCheckout[]>([]);
  const [lookups, setLookups] = useState<TitleLookupRecord[]>([]);
  const [advocateId, setAdvocateId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [notaryNotes, setNotaryNotes] = useState("");
  const [titleNumber, setTitleNumber] = useState("");
  const [county, setCounty] = useState("");
  const [parcelNumber, setParcelNumber] = useState("");
  const [blockNumber, setBlockNumber] = useState("");
  const [registrationSection, setRegistrationSection] = useState("");
  const [landRegistryOffice, setLandRegistryOffice] = useState("");
  const [lookupAssetId, setLookupAssetId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [heirs, setHeirs] = useState<HeirOpt[]>([]);
  const [consentPath, setConsentPath] = useState<"paper_authorization" | "family_assisted">(
    "paper_authorization",
  );
  const [helperId, setHelperId] = useState("");
  const [consentFile, setConsentFile] = useState<File | null>(null);
  const [currency, setCurrency] = useState<CheckoutCurrency>("USD");
  const [kind, setKind] = useState<CheckoutKind>("advocate_fee");
  const [amount, setAmount] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/vault/diaspora");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not load");
      return;
    }
    const o = json.owner;
    if (o) {
      setDiasporaNationalId(o.diasporaNationalId || "");
      setEcitizenId(o.ecitizenId || "");
      setArdhiSasaId(o.ardhiSasaId || "");
      setPassportNumber(o.passportNumber || "");
      setPassportCountry(o.passportCountry || "");
      setCountryOfResidence(o.countryOfResidence || "");
      setIsDiaspora(Boolean(o.isDiaspora));
    }
    setAdvocates(json.advocates || []);
    setBookings(json.bookings || []);
    setCheckouts(json.checkouts || []);
    setLookups(json.lookups || []);
    setAssets(json.assets || []);
    setHeirs(json.heirs || []);
    if (!helperId && json.heirs?.[0]) setHelperId(json.heirs[0].id);
    if (!advocateId && json.advocates?.[0]) setAdvocateId(json.advocates[0].id);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch("/api/vault/diaspora", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diasporaNationalId,
          ecitizenId,
          ardhiSasaId,
          passportNumber,
          passportCountry,
          countryOfResidence,
          isDiaspora: isDiaspora || Boolean(countryOfResidence),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not save");
        return;
      }
      setMessage(sw ? "Maelezo ya diaspora yamehifadhiwa." : "Diaspora identity saved.");
      await load();
    } finally {
      setLoading(false);
    }
  }

  async function scheduleNotary(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!scheduledAt) {
      setError(sw ? "Chagua tarehe na saa." : "Pick a date and time.");
      return;
    }
    const res = await fetch("/api/vault/diaspora/notarization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        advocateId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: notaryNotes,
        diasporaSignerName: signerName,
        diasporaSignerPhone: signerPhone,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not schedule");
      return;
    }
    setMessage(
      sw
        ? "Kipindi cha video notarization kimepangwa na wakili wa LSK."
        : "Video notarization booked with an LSK advocate.",
    );
    await load();
  }

  async function requestAdvocateFiling(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch("/api/vault/diaspora/title-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleNumber,
        county,
        assetId: lookupAssetId || null,
        parcelNumber,
        blockNumber,
        registrationSection,
        landRegistryOffice,
        consentPath,
        consentHelperBeneficiaryId: helperId || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not request filing");
      return;
    }
    setMessage(
      sw
        ? "Ombi limehifadhiwa: Inasubiri uthibitisho."
        : "Request saved: Pending Verification.",
    );
    await load();
  }

  async function uploadPaperConsent(lookupId: string) {
    if (!consentFile) {
      setError(sw ? "Piga picha ya fomu iliyosainiwa." : "Photograph the signed form first.");
      return;
    }
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.set("lookupId", lookupId);
    form.set("file", consentFile);
    const res = await fetch("/api/vault/title-consent", { method: "POST", body: form });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not upload form");
      return;
    }
    setConsentFile(null);
    setMessage(sw ? "Fomu iliyosainiwa imewekwa kwenye hifadhi." : "Signed authorization saved in the vault.");
    await load();
  }

  async function alertFamily(lookupId: string) {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/vault/title-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "alert_family",
        lookupId,
        beneficiaryId: helperId || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Could not alert family");
      return;
    }
    setMessage(
      sw
        ? "Hatua fupi zimetumwa kwa mwanafamilia kwa SMS na WhatsApp."
        : "Simple steps sent to the family helper by SMS and WhatsApp.",
    );
    if (json.notice?.whatsappUrl) {
      window.open(json.notice.whatsappUrl, "_blank", "noopener,noreferrer");
    }
    await load();
  }

  async function startCheckout(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const parsedAmount = amount.trim()
      ? Number(amount)
      : fromKes(CHECKOUT_DEFAULTS_KES[kind], currency);
    const res = await fetch("/api/vault/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        currency,
        amount: parsedAmount,
        mpesaPhone,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Checkout failed");
      return;
    }
    setMessage(
      json.checkout?.gatewayNote ||
        (sw ? "Malipo yamehifadhiwa." : "Checkout recorded."),
    );
    await load();
  }

  const notaryBookings = bookings.filter((b) => b.kind === "video_notarization");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {sw ? "Daraja la diaspora" : "Diaspora Family Bridge"}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {sw
            ? "Wakenya nje ya nchi wanaweza kuunganisha kitambulisho, kuomba wakili wa LSK kuwasilisha utafutaji wa ArdhiSasa, video notarization, na malipo ya sarafu nyingi."
            : "Kenyans abroad can link IDs, ask an LSK advocate to file an ArdhiSasa search, schedule video attestation, and pay in USD, GBP, EUR, or KES."}
        </p>
      </div>
      <PlatformDisclaimer sw={sw} />
      {error && <p className="text-[var(--danger)]">{error}</p>}
      {message && <p className="font-semibold text-forest">{message}</p>}

      <form
        onSubmit={saveProfile}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Kitambulisho cha diaspora" : "Diaspora identity"}
        </h2>
        <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={isDiaspora}
            onChange={(e) => setIsDiaspora(e.target.checked)}
          />
          {sw ? "Ninaishi nje ya Kenya" : "I live outside Kenya"}
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="dnid">
              {sw ? "Nambari ya ID ya Kenya" : "Kenyan / diaspora national ID"}
            </label>
            <input
              id="dnid"
              className="field"
              value={diasporaNationalId}
              onChange={(e) => setDiasporaNationalId(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="ecit">
              eCitizen ID
            </label>
            <input
              id="ecit"
              className="field"
              value={ecitizenId}
              onChange={(e) => setEcitizenId(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="ardhi">
              ArdhiSasa ID
            </label>
            <input
              id="ardhi"
              className="field"
              value={ardhiSasaId}
              onChange={(e) => setArdhiSasaId(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="ppn">
              {sw ? "Pasipoti" : "Passport number"}
            </label>
            <input
              id="ppn"
              className="field"
              value={passportNumber}
              onChange={(e) => setPassportNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="ppc">
              {sw ? "Nchi ya pasipoti" : "Passport country"}
            </label>
            <input
              id="ppc"
              className="field"
              value={passportCountry}
              onChange={(e) => setPassportCountry(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="res">
              {sw ? "Nchi unayoishi" : "Country of residence"}
            </label>
            <input
              id="res"
              className="field"
              placeholder="UK / US / Canada / UAE"
              value={countryOfResidence}
              onChange={(e) => setCountryOfResidence(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "…" : sw ? "Hifadhi" : "Save identity"}
        </button>
      </form>

      <form
        onSubmit={requestAdvocateFiling}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Uthibitisho wa ArdhiSasa" : "ArdhiSasa verification"}
        </h2>
        <div className="rounded-[0.35rem] border-2 border-brass/40 bg-[var(--brass-soft,#f7f1e6)] px-4 py-3">
          <p className="text-base font-semibold text-forest-deep">
            {sw ? "Hali ya uthibitisho wa ArdhiSasa:" : "ArdhiSasa Verification Status:"}{" "}
            <span className="text-brass">
              {ardhisasaStatusLabel(
                lookups[0]?.status || "pending_advocate_submission",
                locale,
              )}
            </span>
          </p>
          <p className="mt-2 text-base text-muted">
            {sw ? ARDHISASA_NOTICE_SW : ARDHISASA_NOTICE_EN}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="linkedLand">
              {sw ? "Mali ya ardhi iliyohifadhiwa" : "Land asset already in the vault"}
            </label>
            <select
              id="linkedLand"
              className="field"
              value={lookupAssetId}
              onChange={(e) => {
                const asset = assets.find((a) => a.id === e.target.value);
                setLookupAssetId(e.target.value);
                if (asset) {
                  setTitleNumber(asset.titleNumber || "");
                  setCounty(asset.county || "");
                  setParcelNumber(asset.parcelNumber || "");
                  setBlockNumber(asset.blockNumber || "");
                  setRegistrationSection(asset.registrationSection || "");
                  setLandRegistryOffice(asset.landRegistryOffice || "");
                }
              }}
            >
              <option value="">{sw ? "Ingiza kwa mkono" : "Enter identifiers manually"}</option>
              {assets.filter((a) => isLandLike(a.type)).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.titleNumber || a.parcelNumber || "no LR"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="lr">{sw ? "Nambari ya hati / LR" : "Title / LR number"}</label>
            <input id="lr" className="field" value={titleNumber} onChange={(e) => setTitleNumber(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="parcel">{sw ? "Nambari ya kiwanja" : "Parcel number"}</label>
            <input id="parcel" className="field" value={parcelNumber} onChange={(e) => setParcelNumber(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="block">{sw ? "Nambari ya block" : "Parcel block number"}</label>
            <input id="block" className="field" value={blockNumber} onChange={(e) => setBlockNumber(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="section">{sw ? "Sehemu ya usajili" : "Registry section"}</label>
            <input id="section" className="field" value={registrationSection} onChange={(e) => setRegistrationSection(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="cty">{sw ? "Kaunti / ofisi ya ardhi" : "County / land registry"}</label>
            <input
              id="cty"
              className="field"
              value={landRegistryOffice || county}
              onChange={(e) => {
                setLandRegistryOffice(e.target.value);
                setCounty(e.target.value);
              }}
            />
          </div>
        </div>
        <fieldset className="rounded-[0.35rem] border-2 border-border p-4">
          <legend className="px-2 text-base font-semibold text-forest-deep">
            {sw ? "Jinsi mzee atakavyoidhinisha" : "How the elder will consent"}
          </legend>
          <p className="text-base text-muted">
            {sw
              ? "Si msimbo wa SMS. Wizara inahitaji idhini kwenye akaunti ya ArdhiSasa, au fomu ya karatasi ambayo wakili anawasilisha."
              : "This is not an SMS code. The Ministry needs approval in the ArdhiSasa account, or a signed paper form the advocate files."}
          </p>
          <label className="mt-3 flex min-h-12 items-start gap-3 text-lg">
            <input
              type="radio"
              className="mt-1 h-5 w-5"
              name="consentPath"
              checked={consentPath === "paper_authorization"}
              onChange={() => setConsentPath("paper_authorization")}
            />
            <span>
              <strong>{sw ? "A. Fomu ya karatasi (rahisi zaidi)" : "A. One-page paper form (easiest)"}</strong>
              <span className="mt-1 block text-base text-muted">
                {sw
                  ? "Saini fomu moja wakati wa usajili. Wakili anaipeleka kwenye ArdhiSasa."
                  : "Sign one page during onboarding. The advocate files it on ArdhiSasa."}
              </span>
            </span>
          </label>
          <label className="mt-3 flex min-h-12 items-start gap-3 text-lg">
            <input
              type="radio"
              className="mt-1 h-5 w-5"
              name="consentPath"
              checked={consentPath === "family_assisted"}
              onChange={() => setConsentPath("family_assisted")}
            />
            <span>
              <strong>{sw ? "B. Msaada wa mwanafamilia" : "B. A child or heir helps"}</strong>
              <span className="mt-1 block text-base text-muted">
                {sw
                  ? "Tunatuma hatua fupi kwa SMS/WhatsApp: ingia kwenye ArdhiSasa, fungua Arifa, bonyeza Approve."
                  : "We send simple steps by SMS/WhatsApp: log into ArdhiSasa, open Notifications, tap Approve."}
              </span>
            </span>
          </label>
          {consentPath === "paper_authorization" && (
            <p className="mt-3">
              <Link href="/vault/title-consent" className="font-semibold text-forest underline">
                {sw ? "Chapisha fomu ya ukurasa mmoja" : "Print the one-page authorization"}
              </Link>
            </p>
          )}
          {consentPath === "family_assisted" && (
            <div className="mt-3">
              <label className="field-label" htmlFor="helper">
                {sw ? "Mtoto / mrithi atakayesaidia" : "Child / heir who will help"}
              </label>
              <select
                id="helper"
                className="field"
                value={helperId}
                onChange={(e) => setHelperId(e.target.value)}
              >
                {heirs.length === 0 && (
                  <option value="">{sw ? "Andika warithi kwanza" : "Add heirs first"}</option>
                )}
                {heirs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.fullName}
                    {h.phone ? ` · ${h.phone}` : ""}
                    {h.relationship ? ` · ${h.relationship}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>
        <button type="submit" className="btn btn-secondary-dark">
          {sw ? "Omba wakili wa LSK awasilishe" : "Ask LSK advocate to file"}
        </button>
        {lookups.length > 0 && (
          <ul className="space-y-3">
            {lookups.map((lu) => (
              <li key={lu.id} className="rounded-[0.35rem] border border-border px-4 py-3 text-base">
                <p className="font-semibold text-forest-deep">
                  {ardhisasaStatusLabel(lu.status, locale)}
                </p>
                <p className="text-ink">{lookupParcelSummary(lu)}</p>
                <p className="text-sm text-muted">{consentPathLabel(lu.consentPath, locale)}</p>
                {lu.authorizationPath ? (
                  <a
                    className="mt-1 inline-block font-semibold text-forest underline"
                    href={`/api/secure-docs/view?kind=title_consent&lookupId=${lu.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {sw ? "Fungua fomu iliyosainiwa" : "View signed authorization"}
                  </a>
                ) : lu.consentPath !== "family_assisted" ? (
                  <div className="mt-3 space-y-2">
                    <input
                      className="field"
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => setConsentFile(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary-dark"
                      onClick={() => void uploadPaperConsent(lu.id)}
                    >
                      {sw ? "Pakia fomu iliyosainiwa" : "Upload signed form"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="btn btn-secondary-dark"
                      onClick={() => void alertFamily(lu.id)}
                    >
                      {lu.familyAlertSentAt
                        ? sw
                          ? "Tuma tena hatua kwa mwanafamilia"
                          : "Send the steps to family again"
                        : sw
                          ? "Tuma hatua fupi kwa mwanafamilia"
                          : "Send simple steps to family"}
                    </button>
                    {lu.consentHelperName ? (
                      <p className="mt-1 text-sm text-muted">
                        {sw ? "Msaidizi:" : "Helper:"} {lu.consentHelperName}
                        {lu.familyAlertSentAt
                          ? ` · ${new Date(lu.familyAlertSentAt).toLocaleString()}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                )}
                {lu.documentPath ? (
                  <a
                    className="mt-1 inline-block font-semibold text-forest underline"
                    href={`/api/secure-docs/view?kind=title_search&lookupId=${lu.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {sw ? "Fungua cheti rasmi" : "View official search certificate"}
                  </a>
                ) : (
                  <p className="mt-1 text-sm text-muted">
                    {sw
                      ? "Cheti kitaonekana hapa baada ya wakili kupakia PDF kutoka ArdhiSasa."
                      : "The official PDF will appear here after the advocate uploads it from ArdhiSasa."}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </form>

      <form
        onSubmit={scheduleNotary}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Video notarization (ubalozi / LSK)" : "Consular & LSK video notarization"}
        </h2>
        <p className="text-base text-muted">
          {sw
            ? "Panga kipindi cha video na wakili wa LSK ili mshirika wa familia nje ya nchi atie sahihi kwenye Family Land Trust."
            : "Book a video slot so an overseas family co-signer can attest a Family Land Trust alongside an LSK advocate."}
        </p>
        <label className="field-label" htmlFor="adv">{sw ? "Wakili wa LSK" : "LSK advocate"}</label>
        <select
          id="adv"
          className="field"
          value={advocateId}
          onChange={(e) => setAdvocateId(e.target.value)}
        >
          {advocates.length === 0 && <option value="">{sw ? "Hakuna wakili bado" : "No advocates on the roster yet"}</option>}
          {advocates.map((a) => (
            <option key={a.id} value={a.id}>
              {a.fullName}
              {a.advocateLicense ? ` · ${a.advocateLicense}` : ""}
              {a.county ? ` · ${a.county}` : ""}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="slot">{sw ? "Tarehe na saa" : "Date and time"}</label>
        <input
          id="slot"
          type="datetime-local"
          className="field"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="sn">{sw ? "Jina la mthibitishaji" : "Overseas signer name"}</label>
            <input id="sn" className="field" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="sp">{sw ? "Simu / WhatsApp" : "Signer phone / WhatsApp"}</label>
            <input id="sp" className="field" value={signerPhone} onChange={(e) => setSignerPhone(e.target.value)} />
          </div>
        </div>
        <textarea
          className="field min-h-[4rem]"
          placeholder={sw ? "Maelezo" : "Notes for the advocate"}
          value={notaryNotes}
          onChange={(e) => setNotaryNotes(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!advocateId}>
          {sw ? "Panga video" : "Schedule video attestation"}
        </button>
        <ul className="space-y-2 text-base text-muted">
          {notaryBookings.map((b) => (
            <li key={b.id}>
              {new Date(b.scheduledAt).toLocaleString()} · {b.status}
              {b.diasporaSignerName ? ` · ${b.diasporaSignerName}` : ""}
            </li>
          ))}
        </ul>
      </form>

      <form
        onSubmit={startCheckout}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Malipo ya sarafu nyingi" : "Multi-currency billing"}
        </h2>
        <p className="text-base text-muted">
          {sw
            ? "KES kwa M-Pesa STK Push. USD / GBP / EUR kwa Stripe. Bila siri za lango, malipo yatahifadhiwa kwa ops."
            : "KES via M-Pesa STK Push. USD, GBP, or EUR via Stripe. If gateway secrets are not on the Worker, the intent is still recorded for ops."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="kind">{sw ? "Aina" : "Fee type"}</label>
            <select id="kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as CheckoutKind)}>
              <option value="advocate_fee">{sw ? "Ada ya wakili" : "Advocate fee"}</option>
              <option value="estate_maintenance">{sw ? "Matengenezo ya mali" : "Estate maintenance"}</option>
              <option value="review">{sw ? "Ukaguzi" : "Legal review"}</option>
              <option value="amendment">{sw ? "Marekebisho" : "Amendment"}</option>
              <option value="title_lookup">{sw ? "Utafutaji wa hati" : "Title lookup"}</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="cur">{sw ? "Sarafu" : "Currency"}</label>
            <select
              id="cur"
              className="field"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CheckoutCurrency)}
            >
              <option value="KES">KES · M-Pesa</option>
              <option value="USD">USD · Stripe</option>
              <option value="GBP">GBP · Stripe</option>
              <option value="EUR">EUR · Stripe</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="amt">{sw ? "Kiasi" : "Amount"}</label>
            <input
              id="amt"
              className="field"
              inputMode="decimal"
              placeholder={String(fromKes(CHECKOUT_DEFAULTS_KES[kind], currency))}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="mp">
              {sw ? "Simu ya M-Pesa (Kenya)" : "M-Pesa phone (Kenya)"}
            </label>
            <input
              id="mp"
              className="field"
              placeholder="0712 345 678"
              value={mpesaPhone}
              onChange={(e) => setMpesaPhone(e.target.value)}
            />
          </div>
        </div>
        <button type="submit" className="btn btn-brass">
          {currency === "KES" ? (sw ? "Anzisha STK" : "Start M-Pesa STK") : sw ? "Anzisha Stripe" : "Start Stripe checkout"}
        </button>
        <ul className="space-y-2 text-base text-muted">
          {checkouts.slice(0, 6).map((c) => (
            <li key={c.id}>
              {c.currency} {c.amount} · {c.provider} · {c.status}
              {c.gatewayNote ? ` — ${c.gatewayNote}` : ""}
            </li>
          ))}
        </ul>
      </form>
    </div>
  );
}
