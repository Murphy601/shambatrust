"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { vaultCopy } from "@/lib/vault-copy";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  ELDER_CONSENT_TEXT_EN,
  ELDER_CONSENT_TEXT_SW,
} from "@/lib/compliance/notices";
import type { PackageTier, ReviewRequest } from "@/lib/db/types";

function formatRemaining(ms: number, sw: boolean): string {
  if (ms <= 0) return sw ? "imeisha" : "ended";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (sw) return `Saa ${hours} na dakika ${mins} zimebaki`;
  return `${hours}h ${mins}m left`;
}

export default function ReviewPage() {
  const { locale } = useLocale();
  const t = vaultCopy(locale);
  const sw = locale === "sw";
  const [packageTier, setPackageTier] = useState<PackageTier>("standard");
  const [consultMode, setConsultMode] = useState<"whatsapp" | "video" | "in_person">(
    "whatsapp",
  );
  const [instruments, setInstruments] = useState<Array<"will" | "land_trust" | "poa">>([
    "will",
  ]);
  const [notes, setNotes] = useState("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [reviews, setReviews] = useState<ReviewRequest[]>([]);
  const [locked, setLocked] = useState(false);
  const [amendmentOpen, setAmendmentOpen] = useState(false);
  const [canRequestAmendment, setCanRequestAmendment] = useState(false);
  const [freeWindow, setFreeWindow] = useState(false);
  const [freeRemainingMs, setFreeRemainingMs] = useState(0);
  const [amendReason, setAmendReason] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [amending, setAmending] = useState(false);

  async function load() {
    const [reviewRes, summaryRes, amendRes] = await Promise.all([
      fetch("/api/vault/review"),
      fetch("/api/vault/summary"),
      fetch("/api/vault/amendment"),
    ]);
    const reviewData = await reviewRes.json();
    if (reviewRes.ok) {
      setReviews(reviewData.reviews);
      setLocked(Boolean(reviewData.locked));
      setAmendmentOpen(Boolean(reviewData.amendmentOpen));
    }
    if (summaryRes.ok) {
      const summary = await summaryRes.json();
      const c = summary.counts;
      setReady(c.assets >= 1 && c.beneficiaries >= 1 && c.allocations >= 1);
      if (summary.vault) {
        setLocked(
          summary.vault.status !== "draft" && !summary.vault.amendmentOpen,
        );
        setAmendmentOpen(Boolean(summary.vault.amendmentOpen));
      }
    }
    if (amendRes.ok) {
      const amend = await amendRes.json();
      setCanRequestAmendment(Boolean(amend.canRequestAmendment));
      setFreeWindow(Boolean(amend.freeWindow));
      setFreeRemainingMs(Number(amend.freeRemainingMs) || 0);
      setAmendmentOpen(Boolean(amend.amendmentOpen));
      setLocked(Boolean(amend.locked));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function requestAmendment(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setAmending(true);
    try {
      const res = await fetch("/api/vault/amendment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: amendReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not open amendment");
        return;
      }
      setMessage(
        data.free
          ? sw
            ? "Marekebisho yamefunguliwa bure. Ongeza mali, kisha wasilisha tena."
            : "Amendment opened free. Add your assets, then resubmit."
          : sw
            ? "Marekebisho yamefunguliwa (ada ya marekebisho). Ongeza mali, kisha wasilisha tena."
            : "Amendment opened (amendment fee applies). Add your assets, then resubmit.",
      );
      setAmendReason("");
      await load();
    } finally {
      setAmending(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!consentAccepted) {
      setError(
        sw
          ? "Lazima ukubali taarifa ya kushiriki nyaraka na wakili."
          : "Please accept the advocate document-sharing consent.",
      );
      return;
    }
    const res = await fetch("/api/vault/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageTier,
        consultMode,
        instruments,
        notes,
        consentAccepted: true,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not submit");
      return;
    }
    if (data.isAmendment) {
      setMessage(
        data.billed
          ? sw
            ? "Marekebisho yamewasilishwa. Ada ya marekebisho imetumika — rasimu zimefungwa."
            : "Amendment submitted. Amendment fee applied — drafts are locked again."
          : sw
            ? "Marekebisho yamewasilishwa bure (ndani ya saa 48). Rasimu zimefungwa."
            : "Amendment submitted free (within 48h). Drafts are locked again.",
      );
    } else {
      setMessage(
        sw
          ? "Ombi limewasilishwa. Hii ndiyo hatua inayotozwa — rasimu zimefungwa."
          : "Request submitted. This is the billable milestone — drafts are now locked.",
      );
    }
    await load();

    const wa = sw
      ? `Habari ShambaTrust, nimewasilisha ${data.isAmendment ? "marekebisho ya" : "ombi la"} ukaguzi wa kisheria (${packageTier}, ${consultMode}).`
      : `Hello ShambaTrust, I submitted a legal review ${data.isAmendment ? "amendment" : "request"} (${packageTier}, ${consultMode}).`;
    window.open(buildWhatsAppUrl(wa), "_blank", "noopener,noreferrer");
  }

  const banner = amendmentOpen
    ? t.amendmentBanner
    : locked
      ? t.submittedBanner
      : t.draftBanner;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">{t.reviewTitle}</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">{t.reviewSubtitle}</p>
        <p className="mt-2 text-base font-medium text-forest">{banner}</p>
      </div>

      {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
      {message && <p className="text-base font-medium text-forest">{message}</p>}

      {canRequestAmendment && (
        <form
          onSubmit={requestAmendment}
          className="space-y-4 rounded-[0.45rem] border-2 border-brass bg-surface p-5 sm:p-7"
        >
          <h2 className="text-2xl font-semibold text-forest-deep">
            {t.requestAmendment}
          </h2>
          <p className="text-base text-muted">
            {freeWindow ? t.amendmentFreeHint : t.amendmentPaidHint}
          </p>
          {freeWindow && (
            <p className="text-base font-semibold text-forest">
              {formatRemaining(freeRemainingMs, sw)}
            </p>
          )}
          <div>
            <label className="field-label" htmlFor="amendReason">
              {t.amendmentReasonLabel}
            </label>
            <textarea
              id="amendReason"
              className="field min-h-[5rem]"
              required
              minLength={3}
              value={amendReason}
              onChange={(e) => setAmendReason(e.target.value)}
              placeholder={t.amendmentReasonPlaceholder}
            />
          </div>
          <button
            type="submit"
            className="btn btn-brass"
            disabled={amending || amendReason.trim().length < 3}
          >
            {t.requestAmendment}
          </button>
        </form>
      )}

      {amendmentOpen && (
        <div className="flex flex-wrap gap-3 rounded-[0.45rem] border-2 border-forest bg-surface p-5">
          <Link href="/vault/assets" className="btn btn-secondary-dark">
            {t.assets}
          </Link>
          <Link href="/vault/heirs" className="btn btn-secondary-dark">
            {t.heirs}
          </Link>
        </div>
      )}

      {!locked && !ready && (
        <div className="rounded-[0.45rem] border-2 border-brass bg-surface p-5">
          <p className="text-lg text-ink">
            {sw
              ? "Kabla ya kuwasilisha: ongeza angalau mali 1, mrithi 1, na ugawaji 1."
              : "Before submitting: add at least 1 asset, 1 heir, and 1 allocation."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/vault/assets" className="btn btn-secondary-dark">
              {t.assets}
            </Link>
            <Link href="/vault/heirs" className="btn btn-secondary-dark">
              {t.heirs}
            </Link>
          </div>
        </div>
      )}

      {!locked && ready && (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7"
        >
          <div>
            <label className="field-label" htmlFor="tier">
              {sw ? "Kifurushi" : "Package"}
            </label>
            <select
              id="tier"
              className="field"
              value={packageTier}
              onChange={(e) => setPackageTier(e.target.value as PackageTier)}
            >
              <option value="vault">Digital Vault</option>
              <option value="standard">Standard Legacy Package</option>
              <option value="premium">Trust & Business Estate</option>
            </select>
          </div>
          <fieldset className="space-y-2">
            <legend className="field-label">
              {sw ? "Nyaraka za kuandaa" : "Instruments to prepare"}
            </legend>
            <p className="text-sm text-muted">
              {sw
                ? "Wosia hulinda M-Pesa na SACCO. Amana hulinda mashamba yasigawanywe."
                : "A will covers M-Pesa and SACCOs. A family land trust keeps shambas unified."}
            </p>
            {(
              [
                ["will", sw ? "Wosia (Last Will)" : "Last Will & Testament"],
                [
                  "land_trust",
                  sw ? "Amana ya ardhi ya familia" : "Family Land Trust / Living Trust",
                ],
                ["poa", sw ? "Uwakilishi wa nguvu" : "Power of Attorney"],
              ] as const
            ).map(([id, label]) => (
              <label key={id} className="flex items-center gap-3 text-base">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={instruments.includes(id)}
                  onChange={(e) => {
                    setInstruments((current) => {
                      if (e.target.checked) return [...current, id];
                      const next = current.filter((item) => item !== id);
                      return next.length ? next : current;
                    });
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div>
            <label className="field-label" htmlFor="consult">
              {sw ? "Njia ya ushauri" : "Consultation mode"}
            </label>
            <select
              id="consult"
              className="field"
              value={consultMode}
              onChange={(e) =>
                setConsultMode(e.target.value as "whatsapp" | "video" | "in_person")
              }
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="video">Video call</option>
              <option value="in_person">In person</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="notes">
              {sw ? "Maelezo kwa wakili" : "Notes for the advocate"}
            </label>
            <textarea
              id="notes"
              className="field min-h-[6rem]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <p className="text-base text-muted">
            {amendmentOpen
              ? sw
                ? "Marekebisho: utatozwa tu kama dirisha la saa 48 limeisha (au kama ada ilishachukuliwa ulipofungua)."
                : "Amendment: you are charged only if the 48h window ended (or the fee was already taken when you opened)."
              : sw
                ? "Kifurushi kinajumuisha ada ya jukwaa + ada ya wakili (escrow). Rasimu za awali hazitozwi."
                : "Packages include platform fee + advocate fee (escrow). Earlier draft edits are not billed."}
          </p>
          <label className="flex items-start gap-3 rounded-[0.35rem] border-2 border-border bg-bg px-4 py-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              required
            />
            <span className="text-base text-ink">
              {sw ? ELDER_CONSENT_TEXT_SW : ELDER_CONSENT_TEXT_EN}
            </span>
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!consentAccepted}
          >
            {amendmentOpen ? t.resubmitAmendment : t.submitReview}
          </button>
        </form>
      )}

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Malipo (KES / USD / GBP / EUR)" : "Pay advocate & estate fees"}
        </h2>
        <p className="mt-2 text-base text-muted">
          {sw
            ? "Lipa kwa M-Pesa (KES) au Stripe (USD, GBP, EUR) kwenye daraja la diaspora."
            : "Pay KES via M-Pesa STK or USD/GBP/EUR via Stripe on the Diaspora bridge."}
        </p>
        <Link href="/vault/diaspora" className="mt-4 inline-block btn btn-brass">
          {sw ? "Fungua malipo" : "Open multi-currency checkout"}
        </Link>
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          {sw ? "Maombi yaliyotumwa" : "Submitted requests"}
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-lg text-muted">
            {sw ? "Hakuna ombi bado." : "No requests yet."}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reviews.map((review) => (
              <li key={review.id} className="border-l-4 border-forest pl-3">
                <p className="text-lg font-semibold capitalize text-ink">
                  {review.packageTier} · {review.consultMode.replace("_", " ")}
                </p>
                <p className="text-base text-muted">
                  {review.status} · {new Date(review.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
