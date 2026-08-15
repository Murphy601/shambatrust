import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import {
  getVaultForUser,
  listAllocations,
  listAssets,
  listAudit,
  listBeneficiaries,
  listLegalDocuments,
  listReviewRequests,
} from "@/lib/db/store";
import {
  freeAmendmentRemainingMs,
  isWithinFreeAmendmentWindow,
  vaultContentLocked,
} from "@/lib/vault-lock";

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
  const [assets, beneficiaries, allocations, reviews, audit, legalDocs] =
    await Promise.all([
      listAssets(vault.id),
      listBeneficiaries(vault.id),
      listAllocations(vault.id),
      listReviewRequests(vault.id),
      listAudit(vault.id),
      listLegalDocuments(vault.id),
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep sm:text-4xl">
          Your Shamba Vault
        </h1>
        <p className="mt-2 text-lg text-muted">
          Status:{" "}
          <span className="font-semibold capitalize text-forest">
            {vault.status.replace("_", " ")}
          </span>
          {asAgent ? " · Editing as family agent" : ""}
        </p>
        <p className="mt-2 text-base font-medium text-forest">
          {vault.amendmentOpen
            ? "Amendment open — add missing assets, then resubmit on Legal review."
            : locked
              ? "Submitted — package in review. Draft edits are locked."
              : "Draft — free to edit. Charged only when you submit for legal review."}
        </p>
        {canAmend && (
          <p className="mt-3 text-base text-muted">
            Need to add land, bank accounts, or cars?{" "}
            <Link href="/vault/review" className="font-semibold text-forest underline">
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Assets" value={String(assets.length)} href="/vault/assets" />
        <Stat
          label="Heirs"
          value={String(beneficiaries.length)}
          href="/vault/heirs"
        />
        <Stat
          label="Allocations"
          value={String(allocations.length)}
          href="/vault/heirs#allocate"
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
            No sealed documents yet. They appear after advocate sign-off.
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
                <span className="capitalize">{doc.type.replace("_", " ")}</span>
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

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[0.45rem] border-2 border-border bg-surface p-5 hover:border-forest"
    >
      <p className="text-base font-semibold text-muted">{label}</p>
      <p className="brand-font mt-2 text-4xl font-semibold text-forest-deep">
        {value}
      </p>
    </Link>
  );
}
