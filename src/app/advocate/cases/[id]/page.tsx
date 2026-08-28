"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocale } from "@/components/locale-provider";
import { formatPhoneDisplay } from "@/lib/auth/phone";
import { formatDuration } from "@/lib/audio";
import { advocateCopy } from "@/lib/advocate-copy";
import { nomineeTotal, parcelIdentifiers } from "@/lib/asset-fields";
import { ADVOCATE_SLA_NOTICE_EN, ADVOCATE_SLA_NOTICE_SW } from "@/lib/compliance/notices";
import {
  ARDHISASA_NOTICE_EN,
  ardhisasaStatusLabel,
  lookupParcelSummary,
} from "@/lib/land-registry/verification";
import type {
  Allocation,
  Asset,
  Beneficiary,
  CaseMessage,
  ChecklistItem,
  ConsultBooking,
  LegalDocument,
  ReviewRequest,
  TitleLookupRecord,
  Vault,
} from "@/lib/db/types";
import { BILLING_AMOUNTS_KES, FEE_SPLIT } from "@/lib/ops/billing";

type CasePayload = {
  review: ReviewRequest;
  vault: Vault;
  owner: { id: string; fullName: string; phone: string } | null;
  assets: Array<Asset & { hasDocument?: boolean }>;
  beneficiaries: Beneficiary[];
  allocations: Allocation[];
  documents: Array<LegalDocument & { hasFile?: boolean }>;
  sealHistory: Array<
    Pick<
      LegalDocument,
      | "id"
      | "reviewRequestId"
      | "title"
      | "type"
      | "status"
      | "signedAt"
      | "createdAt"
      | "updatedAt"
    >
  >;
  lookups: TitleLookupRecord[];
  delta: {
    previousReviewId: string;
    previousReviewCreatedAt: string;
    assets: { before: number; now: number };
    heirs: { before: number; now: number };
    allocations: { before: number; now: number };
    newAssetTitles: string[];
  } | null;
  testaments: Array<{
    id: string;
    title: string;
    languageLabel: string;
    durationSeconds: number | null;
    transcript: string;
    transcriptStatus: string;
    recordedByAgent: boolean;
    assetId: string | null;
    createdAt: string;
  }>;
  match: {
    status: string;
    reason: string;
    matchedCounties: string[];
  } | null;
  access: {
    sensitive: boolean;
    docAccess: boolean;
    reason: string | null;
  };
};

export default function AdvocateCasePage() {
  const params = useParams();
  const id = String(params.id || "");
  const { locale } = useLocale();
  const t = advocateCopy(locale);

  const [data, setData] = useState<CasePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [consultAt, setConsultAt] = useState("");
  const [consultNotes, setConsultNotes] = useState("");
  const [consultMode, setConsultMode] = useState<
    "whatsapp" | "video" | "in_person"
  >("whatsapp");
  const [bookings, setBookings] = useState<ConsultBooking[]>([]);
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [messageTo, setMessageTo] = useState<"elder" | "ops">("elder");
  const [messageBody, setMessageBody] = useState("");

  const [docType, setDocType] = useState<"will" | "land_trust" | "poa">("will");
  const [docTitle, setDocTitle] = useState("");
  const [docBody, setDocBody] = useState("");

  const [stampDocId, setStampDocId] = useState("");
  const [stampCounty, setStampCounty] = useState("");
  const [stampNotes, setStampNotes] = useState("");

  const [signDocId, setSignDocId] = useState("");
  const [signatureName, setSignatureName] = useState("");
  const [certFile, setCertFile] = useState<File | null>(null);
  const [sealCase, setSealCase] = useState(true);

  const [lookupAssetId, setLookupAssetId] = useState("");
  const [lookupTitle, setLookupTitle] = useState("");
  const [lookupCounty, setLookupCounty] = useState("");
  const [lookupParcel, setLookupParcel] = useState("");
  const [lookupBlock, setLookupBlock] = useState("");
  const [lookupSection, setLookupSection] = useState("");
  const [lookupRegistry, setLookupRegistry] = useState("");
  const [lookupNotes, setLookupNotes] = useState("");
  const [lookupCertFile, setLookupCertFile] = useState<File | null>(null);
  const [uploadLookupId, setUploadLookupId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/reviews/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load case");
      setData({
        ...json,
        access: json.access || {
          sensitive: false,
          docAccess: false,
          reason: "Claim this case to unlock documents.",
        },
      });
      setChecklist(json.review.checklist || []);
      setConsultAt(
        json.review.consultScheduledAt
          ? json.review.consultScheduledAt.slice(0, 16)
          : "",
      );
      setConsultNotes(json.review.consultNotes || "");
      setConsultMode(json.review.consultMode || "whatsapp");
      if (json.review.advocateId) {
        const [messagesRes, bookingsRes] = await Promise.all([
          fetch(`/api/advocate/reviews/${id}/messages`),
          fetch(`/api/advocate/reviews/${id}/consult`),
        ]);
        if (messagesRes.ok) {
          const payload = await messagesRes.json();
          setMessages(payload.messages || []);
        }
        if (bookingsRes.ok) {
          const payload = await bookingsRes.json();
          setBookings(payload.bookings || []);
        }
      }
      if (!signDocId && json.documents?.[0]) {
        setSignDocId(json.documents[0].id);
      }
      if (!stampDocId && json.documents?.[0]) {
        setStampDocId(json.documents[0].id);
      }
      const land = (json.assets as Asset[]).find(
        (a) => a.type === "land" || a.type === "commercial_plot",
      );
      if (land) {
        setLookupAssetId(land.id);
        setLookupTitle(land.titleNumber || "");
        setLookupCounty(land.county || "");
        setLookupParcel(land.parcelNumber || "");
        setLookupBlock(land.blockNumber || "");
        setLookupSection(land.registrationSection || "");
        setLookupRegistry(land.landRegistryOffice || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id, signDocId, stampDocId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per id
  }, [id]);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/reviews/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slaAccepted: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not claim");
      setMessage("Case claimed. Document access is view-only and logged.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim");
    } finally {
      setBusy(false);
    }
  }

  async function saveChecklist(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setMessage("Checklist saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveConsult(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/reviews/${id}/consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: consultMode,
          scheduledAt: new Date(consultAt).toISOString(),
          notes: consultNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setMessage("Consultation schedule saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/reviews/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: messageTo, body: messageBody }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Message failed");
      setMessageBody("");
      setMessage("Message sent.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message failed");
    } finally {
      setBusy(false);
    }
  }

  async function addDocument(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/reviews/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: docType,
          title: docTitle,
          body: docBody,
          status: "ready_for_sign",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save document");
      setDocTitle("");
      setDocBody("");
      setSignDocId(json.document.id);
      setMessage("Document draft saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save document");
    } finally {
      setBusy(false);
    }
  }

  async function openFiling(event: FormEvent) {
    event.preventDefault();
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/advocate/title-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          reviewId: id,
          vaultId: data.vault.id,
          assetId: lookupAssetId || null,
          titleNumber: lookupTitle,
          county: lookupCounty,
          parcelNumber: lookupParcel,
          blockNumber: lookupBlock,
          registrationSection: lookupSection,
          landRegistryOffice: lookupRegistry,
          advocateNotes: lookupNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not open filing");
      setMessage(
        "Filing opened: Pending Advocate Submission. Log into ArdhiSasa on your professional account to request owner OTP consent.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open filing");
    } finally {
      setBusy(false);
    }
  }

  async function markFiled(lookupId: string) {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/advocate/title-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_filed",
          lookupId,
          reviewId: id,
          vaultId: data.vault.id,
          advocateNotes: lookupNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not mark filed");
      setMessage("Marked filed. Waiting for the registered owner's OTP consent on ArdhiSasa.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark filed");
    } finally {
      setBusy(false);
    }
  }

  async function withdrawFiling(lookupId: string) {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/advocate/title-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "withdraw",
          lookupId,
          reviewId: id,
          vaultId: data.vault.id,
          advocateNotes: lookupNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not withdraw");
      setMessage("Filing withdrawn.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not withdraw");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCertificate(event: FormEvent) {
    event.preventDefault();
    if (!data || !lookupCertFile) {
      setError("Choose the official ArdhiSasa search PDF first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", lookupCertFile);
      form.set("vaultId", data.vault.id);
      form.set("reviewId", id);
      if (uploadLookupId) form.set("lookupId", uploadLookupId);
      if (lookupAssetId) form.set("assetId", lookupAssetId);
      if (lookupTitle) form.set("titleNumber", lookupTitle);
      if (lookupCounty) form.set("county", lookupCounty);
      if (lookupNotes) form.set("advocateNotes", lookupNotes);
      const res = await fetch("/api/advocate/title-lookup", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setMessage("Official search certificate stored in the elder's Document Vault.");
      setLookupCertFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function applyStamp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/advocate/reviews/${id}/stamp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: stampDocId,
          county: stampCounty,
          notes: stampNotes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not stamp document");
      setMessage(`Legal stamp ${json.document.stampRef} applied.`);
      setStampNotes("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not stamp document");
    } finally {
      setBusy(false);
    }
  }

  async function signAndSeal(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("documentId", signDocId);
      form.set("signatureName", signatureName);
      form.set("sealCase", sealCase ? "true" : "false");
      if (certFile) form.set("file", certFile);

      const res = await fetch(`/api/advocate/reviews/${id}/sign`, {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sign failed");
      setMessage(
        sealCase
          ? "Document signed and vault sealed."
          : "Document signed (case still open).",
      );
      setCertFile(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-lg text-muted">Loading case…</p>;
  }

  if (!data) {
    return (
      <div>
        <p className="text-lg text-[var(--danger)]">{error || "Case not found"}</p>
        <Link href="/advocate/queue" className="mt-4 inline-block text-forest underline">
          {t.backQueue}
        </Link>
      </div>
    );
  }

  const {
    review,
    vault,
    owner,
    assets,
    beneficiaries,
    allocations,
    documents,
    sealHistory,
    lookups,
    delta,
    testaments,
    match,
    access,
  } = data;
  const landAssets = assets.filter(
    (a) => a.type === "land" || a.type === "commercial_plot",
  );
  const stampTarget = documents.find((d) => d.id === stampDocId) || null;
  const signTarget = documents.find((d) => d.id === signDocId) || null;
  const slaNotice = locale === "sw" ? ADVOCATE_SLA_NOTICE_SW : ADVOCATE_SLA_NOTICE_EN;
  const packageAmount = BILLING_AMOUNTS_KES.review_submitted[review.packageTier];
  const advocateShare = Math.round(packageAmount * FEE_SPLIT.advocateShare);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/advocate/queue"
          className="text-base font-semibold text-forest underline-offset-4 hover:underline"
        >
          ← {t.backQueue}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold text-forest-deep sm:text-4xl">
          {owner?.fullName || "Client"} — {t.caseBrief}
        </h1>
        <p className="mt-2 text-lg text-muted">
          {owner?.phone} · {t.package}:{" "}
          <span className="font-semibold capitalize text-forest">
            {review.packageTier}
          </span>{" "}
          · Vault:{" "}
          <span className="font-semibold capitalize">
            {vault.status.replace("_", " ")}
          </span>{" "}
          · Case:{" "}
          <span className="font-semibold capitalize">
            {review.status.replace("_", " ")}
          </span>
        </p>
        {review.status === "submitted" && (
          <div className="mt-4 space-y-3 rounded-[0.45rem] border-2 border-brass bg-[color-mix(in_srgb,var(--brass)_10%,white)] p-4">
            <p className="text-base text-ink">{slaNotice}</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={claim}
            >
              {t.assign} (accept SLA)
            </button>
          </div>
        )}
        {match && match.status === "offered" && (
          <p className="mt-4 rounded-[0.35rem] border-2 border-brass bg-[color-mix(in_srgb,var(--brass)_10%,white)] px-4 py-3 text-base">
            <span className="font-semibold">{t.matchedBadge}:</span>{" "}
            {match.reason}
          </p>
        )}
        {access.reason && (
          <p className="mt-4 rounded-[0.35rem] border border-border bg-surface px-4 py-3 text-base text-muted">
            {access.reason}
          </p>
        )}
      </div>

      {error && (
        <p className="text-base font-medium text-[var(--danger)]">{error}</p>
      )}
      {message && (
        <p className="rounded-[0.35rem] border-2 border-forest bg-[color-mix(in_srgb,var(--forest)_10%,white)] px-4 py-3 text-base font-semibold text-forest-deep">
          {message}
        </p>
      )}

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">{t.caseBrief}</h2>
        <p className="mt-2 text-base text-muted">
          {t.consultMode}: {review.consultMode.replace("_", " ")}
        </p>
        {review.notes && (
          <p className="mt-3 text-lg text-ink">
            <span className="font-semibold">{t.notes}:</span> {review.notes}
          </p>
        )}

        <h3 className="mt-6 text-xl font-semibold text-ink">{t.assets}</h3>
        <ul className="mt-2 space-y-2">
          {assets.map((a) => (
            <li key={a.id} className="border-l-4 border-forest pl-3 text-base">
              <span className="font-semibold">{a.title}</span> ({a.type})
              {a.titleNumber ? ` · LR/Title: ${a.titleNumber}` : ""}
              {a.county ? ` · ${a.county}` : ""}
              {parcelIdentifiers(a).length > 0 && (
                <dl className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                  {parcelIdentifiers(a).map((row) => (
                    <div key={row.label} className="flex gap-2">
                      <dt className="text-muted">{row.label}:</dt>
                      <dd className="font-semibold">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {a.type === "sacco" && (
                <div className="mt-1">
                  {a.saccoName ? (
                    <p className="text-muted">
                      SACCO: {a.saccoName}
                      {a.saccoMemberNumber
                        ? ` · member ${a.saccoMemberNumber}`
                        : ""}
                    </p>
                  ) : null}
                  {a.saccoNominees.length > 0 && (
                    <>
                      <p className="mt-1 font-semibold">
                        Nominees ({nomineeTotal(a.saccoNominees)}%) — paid
                        outside the estate under SACCO bylaws
                      </p>
                      <ul className="mt-0.5 pl-4 text-muted">
                        {a.saccoNominees.map((nominee) => (
                          <li key={nominee.id}>
                            {nominee.fullName}
                            {nominee.relationship
                              ? ` — ${nominee.relationship}`
                              : ""}{" "}
                            · {nominee.percentage}%
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              {a.hasDocument || a.documentName ? (
                <div className="mt-1">
                  {access.docAccess ? (
                    <a
                      className="font-semibold text-forest underline"
                      href={`/api/secure-docs/view?kind=asset&reviewId=${id}&assetId=${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View uploaded document (view only — no download)
                    </a>
                  ) : (
                    <span className="text-muted">
                      Document on file — claim case to view (access ends when sealed)
                    </span>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        <h3 className="mt-6 text-xl font-semibold text-ink">{t.heirs}</h3>
        <ul className="mt-2 space-y-2">
          {beneficiaries.map((b) => (
            <li key={b.id} className="text-base">
              <span className="font-semibold">{b.fullName}</span> — {b.relationship}
              {b.idNumber ? ` · ID ${b.idNumber}` : ""}
              {b.phone ? ` · ${formatPhoneDisplay(b.phone)}` : ""}
            </li>
          ))}
        </ul>

        <h3 className="mt-6 text-xl font-semibold text-ink">{t.allocations}</h3>
        <ul className="mt-2 space-y-2">
          {allocations.length === 0 && (
            <li className="text-base text-muted">None set.</li>
          )}
          {allocations.map((al) => {
            const heir = beneficiaries.find((b) => b.id === al.beneficiaryId);
            const asset = assets.find((a) => a.id === al.assetId);
            const giftLabel =
              asset?.title ||
              (al.specificGift &&
              (!asset || al.specificGift !== asset.title)
                ? al.specificGift
                : "");
            return (
              <li key={al.id} className="text-base">
                {heir?.fullName || "Heir"}
                {al.percentage != null ? ` — ${al.percentage}%` : ""}
                {giftLabel ? ` — ${giftLabel}` : ""}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          {t.testaments}
        </h2>
        {testaments.length === 0 ? (
          <p className="mt-3 text-base text-muted">{t.noTestaments}</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {testaments.map((testament) => {
              const asset = assets.find((a) => a.id === testament.assetId);
              return (
                <li
                  key={testament.id}
                  className="rounded-[0.35rem] border border-border p-4"
                >
                  <p className="text-lg font-semibold text-ink">
                    {testament.title}
                  </p>
                  <p className="text-base text-muted">
                    {testament.languageLabel} ·{" "}
                    {formatDuration(testament.durationSeconds)} ·{" "}
                    {testament.transcriptStatus.replace(/_/g, " ")}
                    {asset ? ` · ${asset.title}` : ""}
                    {testament.recordedByAgent
                      ? " · captured by family agent"
                      : ""}
                  </p>
                  {access.docAccess ? (
                    <audio
                      className="mt-3 w-full"
                      controls
                      preload="none"
                      src={`/api/vault/testaments/${testament.id}/audio`}
                    />
                  ) : (
                    <p className="mt-2 text-base text-muted">
                      Claim this case to play the recording.
                    </p>
                  )}
                  {testament.transcript && (
                    <p className="mt-3 whitespace-pre-wrap text-base text-ink">
                      {testament.transcript}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {delta && (
        <section className="rounded-[0.45rem] border-2 border-brass bg-surface p-5 sm:p-7">
          <h2 className="text-2xl font-semibold text-forest-deep">What changed</h2>
          <p className="mt-2 text-base text-muted">
            Compared with the completed review submitted{" "}
            {new Date(delta.previousReviewCreatedAt).toLocaleString()}.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ["Assets", delta.assets],
              ["Heirs", delta.heirs],
              ["Allocations", delta.allocations],
            ].map(([label, counts]) => {
              const value = counts as { before: number; now: number };
              return (
                <div key={label as string} className="rounded-[0.35rem] border border-border p-3">
                  <p className="font-semibold text-ink">{label as string}</p>
                  <p className="text-muted">
                    {value.before} → {value.now}
                  </p>
                </div>
              );
            })}
          </div>
          {delta.newAssetTitles.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-ink">New asset titles</h3>
              <ul className="mt-1 list-disc pl-5 text-base">
                {delta.newAssetTitles.map((title) => (
                  <li key={title}>{title}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">Fee split</h2>
        <p className="mt-2 text-base text-muted">
          Read-only estimate based on the {review.packageTier} package fee of KES{" "}
          {packageAmount.toLocaleString()}.
        </p>
        <p className="mt-3 text-lg text-ink">
          Platform 35% · Advocate 65% · Estimated advocate share:{" "}
          <span className="font-semibold text-forest">
            KES {advocateShare.toLocaleString()}
          </span>
        </p>
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">{t.checklist}</h2>
        <form onSubmit={saveChecklist} className="mt-4 space-y-3">
          {checklist.map((item, idx) => (
            <label
              key={item.key}
              className="flex min-h-12 items-start gap-3 rounded-[0.35rem] border border-border px-3 py-3"
            >
              <input
                type="checkbox"
                className="mt-1.5 h-5 w-5"
                checked={item.done}
                onChange={(e) => {
                  const next = [...checklist];
                  next[idx] = { ...item, done: e.target.checked };
                  setChecklist(next);
                }}
              />
              <span className="text-lg font-semibold text-ink">{item.label}</span>
            </label>
          ))}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t.saveChecklist}
          </button>
        </form>
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">{t.consult}</h2>
        <form onSubmit={saveConsult} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="consultMode">
              Mode
            </label>
            <select
              id="consultMode"
              className="field"
              value={consultMode}
              onChange={(event) =>
                setConsultMode(
                  event.target.value as "whatsapp" | "video" | "in_person",
                )
              }
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="video">Video</option>
              <option value="in_person">In person</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="consultAt">
              Date & time
            </label>
            <input
              id="consultAt"
              type="datetime-local"
              className="field"
              value={consultAt}
              onChange={(e) => setConsultAt(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="consultNotes">
              Notes
            </label>
            <textarea
              id="consultNotes"
              className="field min-h-24"
              value={consultNotes}
              onChange={(e) => setConsultNotes(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t.scheduleConsult}
          </button>
        </form>
        {bookings.length > 0 && (
          <ul className="mt-5 space-y-2">
            {bookings.map((booking) => (
              <li key={booking.id} className="rounded-[0.35rem] border border-border p-3">
                <span className="font-semibold capitalize">
                  {booking.mode.replace("_", " ")}
                </span>{" "}
                · {new Date(booking.scheduledAt).toLocaleString()} · {booking.status}
                {booking.notes ? ` · ${booking.notes}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      {review.advocateId && (
        <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
          <h2 className="text-2xl font-semibold text-forest-deep">Case messages</h2>
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
            {messages.map((item) => (
              <div key={item.id} className="rounded-[0.35rem] border border-border p-3">
                <p className="text-sm font-semibold capitalize text-forest">
                  {item.fromRole} → {item.to}
                </p>
                <p className="mt-1 text-base text-ink">{item.body}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-base text-muted">No messages yet.</p>
            )}
          </div>
          {review.status !== "completed" && (
            <form onSubmit={sendMessage} className="mt-4 grid gap-3 sm:grid-cols-4">
              <select
                className="field"
                value={messageTo}
                onChange={(event) =>
                  setMessageTo(event.target.value as "elder" | "ops")
                }
              >
                <option value="elder">Elder</option>
                <option value="ops">Operations</option>
              </select>
              <textarea
                className="field min-h-24 sm:col-span-3"
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
                placeholder="Write a case message…"
                required
              />
              <button type="submit" className="btn btn-primary" disabled={busy}>
                Send message
              </button>
            </form>
          )}
        </section>
      )}

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">{t.titleLookup}</h2>
        <p className="mt-2 text-base text-muted">{t.lookupHint}</p>
        <p className="mt-2 text-base italic text-muted">{ARDHISASA_NOTICE_EN}</p>
        <p className="mt-2 text-base font-semibold text-brass">
          Each new filing request charges KES{" "}
          {BILLING_AMOUNTS_KES.title_lookup.toLocaleString()} to this vault.
        </p>
        <form onSubmit={openFiling} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="lookupAsset">
              Linked land asset
            </label>
            <select
              id="lookupAsset"
              className="field"
              value={lookupAssetId}
              onChange={(e) => {
                const asset = landAssets.find((a) => a.id === e.target.value);
                setLookupAssetId(e.target.value);
                if (asset) {
                  setLookupTitle(asset.titleNumber || "");
                  setLookupCounty(asset.county || "");
                  setLookupParcel(asset.parcelNumber || "");
                  setLookupBlock(asset.blockNumber || "");
                  setLookupSection(asset.registrationSection || "");
                  setLookupRegistry(asset.landRegistryOffice || "");
                }
              }}
            >
              <option value="">Manual entry</option>
              {landAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({a.titleNumber || a.parcelNumber || "no LR"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="lookupTitle">
              Title / LR number
            </label>
            <input
              id="lookupTitle"
              className="field"
              value={lookupTitle}
              onChange={(e) => setLookupTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="lookupParcel">
              Parcel number
            </label>
            <input
              id="lookupParcel"
              className="field"
              value={lookupParcel}
              onChange={(e) => setLookupParcel(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="lookupBlock">
              Parcel block number
            </label>
            <input
              id="lookupBlock"
              className="field"
              value={lookupBlock}
              onChange={(e) => setLookupBlock(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="lookupSection">
              Registry section
            </label>
            <input
              id="lookupSection"
              className="field"
              value={lookupSection}
              onChange={(e) => setLookupSection(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="lookupCounty">
              County
            </label>
            <input
              id="lookupCounty"
              className="field"
              value={lookupCounty}
              onChange={(e) => setLookupCounty(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="lookupRegistry">
              County land registry office
            </label>
            <input
              id="lookupRegistry"
              className="field"
              value={lookupRegistry}
              onChange={(e) => setLookupRegistry(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="lookupNotes">
              Filing notes (for the vault)
            </label>
            <textarea
              id="lookupNotes"
              className="field min-h-20"
              value={lookupNotes}
              onChange={(e) => setLookupNotes(e.target.value)}
              placeholder="e.g. Filed on ArdhiSasa professional account; owner notified for OTP."
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t.runLookup}
          </button>
        </form>
        <form onSubmit={uploadCertificate} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="uploadLookupId">
              Attach PDF to an existing filing
            </label>
            <select
              id="uploadLookupId"
              className="field"
              value={uploadLookupId}
              onChange={(e) => setUploadLookupId(e.target.value)}
            >
              <option value="">Create a new filing with this upload</option>
              {lookups
                .filter((lu) => lu.status !== "withdrawn")
                .map((lu) => (
                  <option key={lu.id} value={lu.id}>
                    {ardhisasaStatusLabel(lu.status)} · {lookupParcelSummary(lu) || lu.id}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="ardhiPdf">
              Official ArdhiSasa search PDF
            </label>
            <input
              id="ardhiPdf"
              className="field"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setLookupCertFile(e.target.files?.[0] || null)}
            />
          </div>
          <button type="submit" className="btn btn-secondary-dark" disabled={busy}>
            {t.uploadCert}
          </button>
        </form>
        {lookups.length > 0 && (
          <ul className="mt-5 space-y-3">
            {lookups.slice(0, 8).map((lu) => (
              <li
                key={lu.id}
                className="rounded-[0.35rem] border border-border px-4 py-3 text-base"
              >
                <p className="font-semibold text-forest-deep">
                  {ardhisasaStatusLabel(lu.status)}
                </p>
                <p>{lookupParcelSummary(lu)}</p>
                <div className="mt-1 font-semibold text-forest">
                  Cost: KES {lu.costKes.toLocaleString()}
                </div>
                {lu.advocateNotes ? (
                  <div className="mt-1 text-sm text-muted">{lu.advocateNotes}</div>
                ) : null}
                <div className="mt-1 text-sm text-muted">{lu.result.rawNote}</div>
                {lu.documentPath ? (
                  <a
                    className="mt-2 inline-block font-semibold text-forest underline"
                    href={`/api/secure-docs/view?kind=title_search&lookupId=${lu.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View official search certificate
                  </a>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {lu.status === "pending_advocate_submission" ? (
                    <button
                      type="button"
                      className="btn btn-secondary-dark"
                      disabled={busy}
                      onClick={() => void markFiled(lu.id)}
                    >
                      {t.markFiled}
                    </button>
                  ) : null}
                  {lu.status !== "withdrawn" && lu.status !== "certificate_on_file" ? (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy}
                      onClick={() => void withdrawFiling(lu.id)}
                    >
                      {t.withdrawFiling}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">Seal history</h2>
        <p className="mt-2 text-base text-muted">
          Legal document versions recorded across all reviews of this vault.
        </p>
        <ul className="mt-4 space-y-3">
          {sealHistory.map((document) => (
            <li key={document.id} className="rounded-[0.35rem] border border-border p-3">
              <span className="font-semibold text-ink">{document.title}</span> ·{" "}
              <span className="capitalize">{document.status.replace(/_/g, " ")}</span>
              <div className="mt-1 text-sm text-muted">
                Version {new Date(document.updatedAt).toLocaleString()}
                {document.signedAt
                  ? ` · signed ${new Date(document.signedAt).toLocaleString()}`
                  : " · not signed"}
              </div>
            </li>
          ))}
          {sealHistory.length === 0 && (
            <li className="text-base text-muted">No document versions yet.</li>
          )}
        </ul>
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">{t.legalDocs}</h2>
        <ul className="mt-3 space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="text-base">
              <span className="font-semibold">{d.title}</span> · {t.docTypes[d.type]}{" "}
              ·{" "}
              <span className="capitalize text-forest">{d.status.replace(/_/g, " ")}</span>
              {d.signatureName ? ` · signed: ${d.signatureName}` : ""}
              <div
                className={`mt-1 text-sm font-semibold ${
                  d.stampedAt ? "text-forest" : "text-brass"
                }`}
              >
                {d.stampedAt
                  ? `${t.stamped} · ${d.stampRef} · ${d.stampAdvocateName}${
                      d.stampLskNumber ? ` (LSK ${d.stampLskNumber})` : ""
                    }${d.stampCounty ? ` · ${d.stampCounty}` : ""}`
                  : t.notStamped}
              </div>
              {d.stampNotes && (
                <div className="text-sm text-muted">{d.stampNotes}</div>
              )}
              {d.hasFile && access.docAccess ? (
                <>
                  {" · "}
                  <a
                    className="font-semibold text-forest underline"
                    href={`/api/secure-docs/view?kind=legal&reviewId=${id}&documentId=${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View certified file (view only)
                  </a>
                </>
              ) : null}
            </li>
          ))}
          {documents.length === 0 && (
            <li className="text-base text-muted">No drafts yet.</li>
          )}
        </ul>

        <form onSubmit={addDocument} className="mt-6 grid gap-4">
          <div>
            <label className="field-label" htmlFor="docType">
              Type
            </label>
            <select
              id="docType"
              className="field"
              value={docType}
              onChange={(e) =>
                setDocType(e.target.value as "will" | "land_trust" | "poa")
              }
            >
              <option value="will">{t.docTypes.will}</option>
              <option value="land_trust">{t.docTypes.land_trust}</option>
              <option value="poa">{t.docTypes.poa}</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="docTitle">
              Title
            </label>
            <input
              id="docTitle"
              className="field"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              required
              placeholder="e.g. Last Will of …"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="docBody">
              Draft body
            </label>
            <textarea
              id="docBody"
              className="field min-h-40"
              value={docBody}
              onChange={(e) => setDocBody(e.target.value)}
              placeholder="Key clauses, trustees, distribution…"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t.addDoc}
          </button>
        </form>
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">{t.stamp}</h2>
        <p className="mt-2 text-base text-muted">{t.stampHint}</p>
        {documents.length === 0 ? (
          <p className="mt-3 text-base text-muted">
            Add a document draft above before stamping.
          </p>
        ) : (
          <form onSubmit={applyStamp} className="mt-4 grid gap-4">
            <div>
              <label className="field-label" htmlFor="stampDoc">
                Document
              </label>
              <select
                id="stampDoc"
                className="field"
                value={stampDocId}
                onChange={(e) => setStampDocId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.stampedAt ? t.stamped : t.notStamped})
                  </option>
                ))}
              </select>
            </div>
            {stampTarget?.stampedAt && (
              <p className="rounded-[0.35rem] border border-forest bg-[color-mix(in_srgb,var(--forest)_8%,white)] px-3 py-2 text-base">
                Already stamped as {stampTarget.stampRef} on{" "}
                {new Date(stampTarget.stampedAt).toLocaleString()}. Re-stamping
                keeps the same reference and updates the annotation.
              </p>
            )}
            <div>
              <label className="field-label" htmlFor="stampCounty">
                {t.stampCounty}
              </label>
              <input
                id="stampCounty"
                className="field"
                value={stampCounty}
                onChange={(e) => setStampCounty(e.target.value)}
                placeholder="e.g. Nakuru"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="stampNotes">
                {t.stampNotes}
              </label>
              <textarea
                id="stampNotes"
                className="field min-h-24"
                value={stampNotes}
                onChange={(e) => setStampNotes(e.target.value)}
                placeholder="Clauses verified, title search reference, witnesses present…"
              />
            </div>
            <button type="submit" className="btn btn-brass" disabled={busy}>
              {busy ? "…" : t.applyStamp}
            </button>
          </form>
        )}
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">{t.eSign}</h2>
        <p className="mt-2 text-base text-muted">{t.sealHint}</p>
        <form onSubmit={signAndSeal} className="mt-4 grid gap-4">
          <div>
            <label className="field-label" htmlFor="signDoc">
              Document
            </label>
            <select
              id="signDoc"
              className="field"
              value={signDocId}
              onChange={(e) => setSignDocId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.status})
                </option>
              ))}
            </select>
            {signTarget && !signTarget.stampedAt && (
              <p className="mt-2 text-base font-semibold text-[var(--danger)]">
                {t.stampRequired}
              </p>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="sigName">
              {t.signatureName}
            </label>
            <input
              id="sigName"
              className="field"
              value={signatureName}
              onChange={(e) => setSignatureName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="certFile">
              {t.certifyUpload}
            </label>
            <input
              id="certFile"
              type="file"
              accept=".pdf,image/*"
              className="field"
              onChange={(e) => setCertFile(e.target.files?.[0] || null)}
            />
          </div>
          <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={sealCase}
              onChange={(e) => setSealCase(e.target.checked)}
            />
            {t.sealVault}
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !signTarget?.stampedAt}
          >
            {busy ? "…" : t.eSign}
          </button>
        </form>
      </section>
    </div>
  );
}
