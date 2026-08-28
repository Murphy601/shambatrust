import Link from "next/link";
import { redirect } from "next/navigation";
import { LandingPhoto } from "@/components/landing-photo";
import { isLandLike } from "@/lib/asset-fields";
import { readSession } from "@/lib/auth/session";
import {
  findUserById,
  getVaultForUser,
  listAllocations,
  listAssets,
  listAudioTestaments,
  listAudit,
  listBeneficiaries,
  listLegalDocuments,
  listReviewRequests,
  listTitleLookups,
} from "@/lib/db/store";
import {
  freeAmendmentRemainingMs,
  isWithinFreeAmendmentWindow,
  vaultContentLocked,
} from "@/lib/vault-lock";
import {
  ardhisasaStatusLabel,
  lookupParcelSummary,
} from "@/lib/land-registry/verification";

export default async function VaultDashboardPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  if (session.role === "advocate") redirect("/advocate");

  const access = await getVaultForUser(session.userId);
  if (!access) {
    return (
      <div className="rounded-[0.45rem] border-2 border-border bg-surface p-6">
        <h1 className="text-3xl font-semibold text-forest-deep">No vault yet</h1>
        <p className="mt-3 text-lg text-muted">
          If you were invited as a family helper, ask the elder to invite your
          phone number under Agent Mode, then sign in again.
        </p>
        <p className="mt-3 text-lg text-muted">
          If you are the elder, sign out and create an account as Vault owner.
        </p>
      </div>
    );
  }

  const { vault, asAgent } = access;
  const locked = vaultContentLocked(vault);
  const [
    owner,
    assets,
    beneficiaries,
    allocations,
    reviews,
    audit,
    legalDocs,
    testaments,
    lookups,
  ] = await Promise.all([
    findUserById(vault.ownerId),
    listAssets(vault.id),
    listBeneficiaries(vault.id),
    listAllocations(vault.id),
    listReviewRequests(vault.id),
    listAudit(vault.id),
    listLegalDocuments(vault.id),
    listAudioTestaments(vault.id),
    listTitleLookups(vault.id),
  ]);

  const lastSubmitAt =
    [...reviews].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      ?.createdAt ?? null;
  const canAmend =
    locked && !vault.amendmentOpen && reviews.length > 0;
  const freeAmend = isWithinFreeAmendmentWindow(lastSubmitAt);
  const freeRemainingMs = freeAmendmentRemainingMs(lastSubmitAt);

  const certified = legalDocs.filter(
    (d) => d.status === "signed" || d.status === "certified",
  );

  const assetsDone = assets.length > 0;
  const heirsDone = beneficiaries.length > 0;
  const allocDone = allocations.length > 0;
  const reviewDone = reviews.length > 0 || vault.status !== "draft";

  const steps = [
    {
      label: "Catalog assets",
      done: assetsDone,
      href: "/vault/assets",
      cta: assetsDone ? "Review" : "Start",
      unlocked: true,
    },
    {
      label: "Name heirs",
      done: heirsDone,
      href: "/vault/heirs",
      cta: heirsDone ? "Review" : "Continue",
      unlocked: assetsDone || heirsDone,
    },
    {
      label: "Allocate",
      done: allocDone,
      href: "/vault/heirs#allocate",
      cta: allocDone ? "Review" : "Continue",
      unlocked: heirsDone || allocDone,
    },
    {
      label: "Submit legal review",
      done: reviewDone,
      href: "/vault/review",
      cta: reviewDone ? "View" : "Submit",
      unlocked: assetsDone && heirsDone && allocDone,
    },
  ];

  const nextStep = steps.find((s) => !s.done && s.unlocked) || steps.find((s) => !s.done);

  const titleDeeds = assets.filter(
    (asset) => isLandLike(asset.type) && Boolean(asset.documentPath),
  );
  const gpsPinned = assets.some(
    (asset) => isLandLike(asset.type) && asset.gpsLat != null && asset.gpsLng != null,
  );
  const signedWill = legalDocs.some(
    (doc) =>
      doc.type === "will" &&
      (doc.status === "signed" || doc.status === "certified"),
  );
  const signedTrust = legalDocs.some(
    (doc) =>
      doc.type === "land_trust" &&
      (doc.status === "signed" || doc.status === "certified"),
  );
  const signedPoa = legalDocs.some(
    (doc) =>
      doc.type === "poa" &&
      (doc.status === "signed" || doc.status === "certified"),
  );
  const saccoNominees = assets.some(
    (asset) =>
      asset.type === "sacco" &&
      ((asset.saccoNominees?.length ?? 0) > 0 || Boolean(asset.mpesaNumber)),
  );
  const idOnFile = Boolean(owner?.idFrontPath && owner?.idBackPath);
  const vital = [
    { label: "National ID", done: idOnFile },
    { label: "Title deed / allotment", done: titleDeeds.length > 0 },
    { label: "Last will", done: signedWill || legalDocs.some((d) => d.type === "will") },
    { label: "Family land trust", done: signedTrust || legalDocs.some((d) => d.type === "land_trust") },
    { label: "Power of attorney", done: signedPoa || legalDocs.some((d) => d.type === "poa") },
    { label: "SACCO / M-Pesa nominee", done: saccoNominees },
  ];
  const vitalDone = vital.filter((item) => item.done).length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[0.45rem] border-2 border-border bg-[#0B1D3A] text-white">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 sm:p-7">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#D4AF37]">
              Welcome back
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
              Your Shamba Vault
            </h1>
            <p className="mt-2 text-lg text-slate-200">
              Status:{" "}
              <span className="font-semibold capitalize text-[#D4AF37]">
                {vault.status.replace("_", " ")}
              </span>
              {asAgent ? " · Editing as family agent" : ""}
            </p>
        <p className="mt-2 text-base font-medium text-slate-100">
          {vault.amendmentOpen
            ? "Amendment open — add missing assets, then resubmit on Legal review."
            : locked
              ? "Submitted — package in review. Draft edits are locked."
              : "Draft — free to edit. Charged only when you submit for legal review."}
        </p>
        {canAmend && (
          <p className="mt-3 text-base text-slate-200">
            Need to add land, bank accounts, or cars?{" "}
            <Link href="/vault/review" className="font-semibold text-[#D4AF37] underline">
              Request amendment
            </Link>
            {freeAmend
              ? ` — free for another ${Math.floor(freeRemainingMs / 3600000)}h.`
              : " — amendment fee applies (48h free window ended)."}
          </p>
        )}
        {vault.amendmentOpen && (
          <p className="mt-3">
            <Link href="/vault/assets" className="btn btn-primary">
              Add assets
            </Link>
          </p>
        )}
          </div>
          <LandingPhoto
            src="/landing/hero-kericho.png"
            alt="Kericho farmland at first light — the land this vault protects"
            className="h-48 w-full lg:h-full"
          />
        </div>
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-forest-deep">
              Vital documents
            </h2>
            <p className="mt-1 text-lg text-muted">
              {vitalDone} of {vital.length} on file
              {gpsPinned ? " · GPS pin saved" : ""}
            </p>
          </div>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-border">
            <div
              className="h-full bg-[#1E5631]"
              style={{ width: `${Math.round((vitalDone / vital.length) * 100)}%` }}
            />
          </div>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {vital.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between rounded-[0.35rem] border border-border px-4 py-3"
            >
              <span className="font-semibold text-ink">{item.label}</span>
              <span
                className={`text-sm font-semibold ${
                  item.done ? "text-forest" : "text-brass"
                }`}
              >
                {item.done ? "On file" : "Missing"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PhotoCard
          href="/vault/assets"
          src="/landing/title-verify.png"
          alt="Title deed and boundary marker on Kenyan land"
          label="Shambas & assets"
          value={`${assets.length} listed`}
        />
        <PhotoCard
          href="/vault/heirs"
          src="/landing/family-trust.png"
          alt="Grandparent and grandson walking together"
          label="Heirs & family"
          value={`${beneficiaries.length} named`}
        />
        <PhotoCard
          href="/vault/review"
          src="/landing/advocates.png"
          alt="Advocates reviewing papers in Nairobi"
          label="Will, trust & POA"
          value={reviewDone ? "Submitted" : "Request review"}
        />
        <PhotoCard
          href="/vault/testament"
          src="/landing/how-it-works.png"
          alt="Recording a spoken testament on a phone"
          label="Voice testament"
          value={
            testaments.length
              ? `${testaments.length} recording${testaments.length === 1 ? "" : "s"}`
              : "Record in Kiswahili or English"
          }
        />
        <PhotoCard
          href="/vault/agent"
          src="/landing/pricing-couple.png"
          alt="Family members planning documents together"
          label="Agent mode"
          value="Let a son or daughter help"
        />
        <PhotoCard
          href="/vault/will"
          src="/landing/family-trust.png"
          alt="Family planning a written will together"
          label="Will builder"
          value="5 guided steps · advocate seals it"
        />
        <PhotoCard
          href="/vault/trust"
          src="/landing/title-verify.png"
          alt="Land title held under a family trust"
          label="Family land trust"
          value="Keep shambas unified"
        />
        <PhotoCard
          href="/vault/wishes"
          src="/landing/cta-family.png"
          alt="Family looking across ancestral land"
          label="First 30 Days"
          value="Burial, SACCO & M-Pesa liquidity"
        />
        <PhotoCard
          href="/vault/diaspora"
          src="/landing/advocates.png"
          alt="Advocates reviewing papers in Nairobi"
          label="Diaspora bridge"
          value="IDs, advocate filing, video notary"
        />
        <PhotoCard
          href="/vault/governance"
          src="/landing/family-trust.png"
          alt="Family planning documents together"
          label="Family governance"
          value="Enforcer, co-sign, first-right buyout"
        />
        <PhotoCard
          href="/vault/houses"
          src="/landing/title-verify.png"
          alt="Land title held under a family trust"
          label="Houses (Section 40)"
          value="Polygamous allocation & minor trusts"
        />
        <PhotoCard
          href="/vault/succession"
          src="/landing/cta-family.png"
          alt="Family looking out across their land"
          label="Succession & release"
          value="Dual-guardian unlock"
        />
      </div>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">Vault setup</h2>
        {nextStep && !locked && (
          <p className="mt-2 text-lg text-muted">
            Next:{" "}
            <Link href={nextStep.href} className="font-semibold text-forest underline">
              {nextStep.label}
            </Link>
          </p>
        )}
        <ul className="mt-5 space-y-3">
          {steps.map((step) => {
            const softLocked = !step.unlocked && !step.done;
            return (
              <li key={step.label}>
                {softLocked ? (
                  <div className="flex min-h-12 items-center justify-between gap-3 rounded-[0.35rem] border border-border px-4 py-3 opacity-60">
                    <span className="text-lg font-semibold text-ink">{step.label}</span>
                    <span className="text-base font-semibold text-muted">Locked</span>
                  </div>
                ) : (
                  <Link
                    href={step.href}
                    className="flex min-h-12 items-center justify-between gap-3 rounded-[0.35rem] border border-border px-4 py-3 hover:border-forest"
                  >
                    <span className="text-lg font-semibold text-ink">{step.label}</span>
                    <span
                      className={`text-base font-semibold ${
                        step.done ? "text-forest" : "text-brass"
                      }`}
                    >
                      {step.done ? "Done" : step.cta}
                    </span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          Certified legal documents
        </h2>
        {certified.length === 0 ? (
          <p className="mt-3 text-lg text-muted">
            No sealed documents yet. Ask your advocate for a will, family land
            trust, or power of attorney — they appear here after sign-off.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {certified.map((doc) => (
              <li
                key={doc.id}
                className="border-l-4 border-brass pl-3 text-base text-ink"
              >
                <span className="font-semibold">{doc.title}</span>
                {" — "}
                <span className="capitalize">
                  {doc.type === "land_trust"
                    ? "Family land trust"
                    : doc.type === "poa"
                      ? "Power of attorney"
                      : "Last will & testament"}
                </span>
                {" · "}
                <span className="capitalize text-forest">
                  {doc.status.replace("_", " ")}
                </span>
                {doc.signatureName ? (
                  <div className="text-sm text-muted">
                    Signed by {doc.signatureName}
                    {doc.signedAt
                      ? ` · ${new Date(doc.signedAt).toLocaleString()}`
                      : ""}
                  </div>
                ) : null}
                {doc.documentName ? (
                  <div className="text-sm text-muted">
                    File: {doc.documentName}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">
          ArdhiSasa search certificates
        </h2>
        {lookups.length === 0 ? (
          <p className="mt-3 text-lg text-muted">
            Ministry of Lands searches are filed by your LSK partner advocate.
            Status starts as Pending Advocate Submission. Official PDFs appear
            here after owner OTP consent on ArdhiSasa.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {lookups.map((lookup) => (
              <li
                key={lookup.id}
                className="border-l-4 border-brass pl-3 text-base text-ink"
              >
                <span className="font-semibold">
                  {ardhisasaStatusLabel(lookup.status)}
                </span>
                {lookupParcelSummary(lookup) ? (
                  <>
                    {" — "}
                    {lookupParcelSummary(lookup)}
                  </>
                ) : null}
                {lookup.documentPath ? (
                  <div>
                    <a
                      className="font-semibold text-forest underline"
                      href={`/api/secure-docs/view?kind=title_search&lookupId=${lookup.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View official search PDF
                    </a>
                  </div>
                ) : (
                  <div className="text-sm text-muted">
                    Waiting for the advocate to upload the official ArdhiSasa PDF.
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
        <h2 className="text-2xl font-semibold text-forest-deep">Recent activity</h2>
        {audit.length === 0 ? (
          <p className="mt-3 text-lg text-muted">No activity yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {audit.slice(0, 8).map((entry) => (
              <li
                key={entry.id}
                className="border-l-4 border-forest pl-3 text-base text-ink"
              >
                <span className="font-semibold">{entry.action.replace(/_/g, " ")}</span>
                {" — "}
                {entry.detail}
                <div className="text-sm text-muted">
                  {new Date(entry.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PhotoCard({
  href,
  src,
  alt,
  label,
  value,
}: {
  href: string;
  src: string;
  alt: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="overflow-hidden rounded-[0.45rem] border-2 border-border bg-surface hover:border-forest"
    >
      <LandingPhoto src={src} alt={alt} className="h-36 w-full" />
      <div className="p-4">
        <p className="text-lg font-semibold text-forest-deep">{label}</p>
        <p className="mt-1 text-base text-muted">{value}</p>
      </div>
    </Link>
  );
}
