"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PlatformDisclaimer } from "@/components/platform-disclaimer";
import { useLocale } from "@/components/locale-provider";
import { CHECKOUT_DEFAULTS_KES, fromKes } from "@/lib/payments/fx";
import type {
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

  async function runLookup(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const res = await fetch("/api/vault/diaspora/title-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titleNumber, county }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Lookup failed");
      return;
    }
    const status = json.lookup?.result?.registrationStatus || "checked";
    setMessage(
      sw
        ? `Utafutaji wa ArdhiSasa (mfano): ${status}`
        : `Simulated ArdhiSasa search: ${status}`,
    );
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
            ? "Wakenya nje ya nchi wanaweza kuunganisha kitambulisho, ArdhiSasa, video notarization, na malipo ya sarafu nyingi."
            : "Kenyans abroad can link IDs, run a title search, schedule video attestation with an LSK advocate, and pay in USD, GBP, EUR, or KES."}
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
        onSubmit={runLookup}
        className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
      >
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Utafutaji wa ArdhiSasa / eCitizen" : "ArdhiSasa / eCitizen title search"}
        </h2>
        <p className="text-base text-muted">
          {sw
            ? "Hii ni daraja lililoandaliwa. Utafutaji rasmi wa Wizara unahitaji siri za API — kwa sasa matokeo ni mfano ulioandikwa."
            : "Prepared bridge: a live Ministry API is used when credentials exist. Until then this records a simulated official search against your ArdhiSasa ID."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="lr">{sw ? "Nambari ya LR" : "Title / LR number"}</label>
            <input id="lr" className="field" required value={titleNumber} onChange={(e) => setTitleNumber(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="cty">{sw ? "Kaunti" : "County registry"}</label>
            <input id="cty" className="field" value={county} onChange={(e) => setCounty(e.target.value)} />
          </div>
        </div>
        <button type="submit" className="btn btn-secondary-dark">
          {sw ? "Tafuta hati" : "Run title search"}
        </button>
        {lookups[0] && (
          <p className="text-base text-ink">
            Latest: {lookups[0].titleNumber} · {lookups[0].result.registrationStatus}
            {lookups[0].result.caveats.length
              ? ` · ${lookups[0].result.caveats.length} caveat(s)`
              : ""}
          </p>
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
