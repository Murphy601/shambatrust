import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { readSession } from "@/lib/auth/session";
import {
  findUserById,
  getExecutionPlan,
  getVaultForUser,
  listReviewRequests,
  saveVaultLocator,
} from "@/lib/db/store";
import { emergencyQrSvg } from "@/lib/qr-svg";

export default async function EmergencyCardPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const access = await getVaultForUser(session.userId);
  if (!access) redirect("/vault");

  let vault = access.vault;
  if (!vault.emergencyCardToken) {
    await saveVaultLocator(vault.id, { rotateEmergencyCard: true });
    const refreshed = await getVaultForUser(session.userId);
    if (refreshed) vault = refreshed.vault;
  }
  const token = vault.emergencyCardToken;
  if (!token) redirect("/vault");

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "shambatrust.mikeal-murphy.workers.dev";
  const proto = h.get("x-forwarded-proto") || "https";
  const url = `${proto}://${host}/emergency/${token}`;
  const qr = emergencyQrSvg(url);

  const [owner, reviews, plan] = await Promise.all([
    findUserById(vault.ownerId),
    listReviewRequests(vault.id),
    getExecutionPlan(vault.id),
  ]);
  const assigned = [...reviews]
    .filter((r) => r.advocateId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const advocate = assigned?.advocateId
    ? await findUserById(assigned.advocateId)
    : null;
  const sw = owner?.locale === "sw";
  const contact =
    vault.emergencyPrimaryContactName ||
    plan?.trustees[0]?.fullName ||
    vault.burialWishes?.committeeLead1 ||
    "—";
  const phone =
    vault.emergencyPrimaryContactPhone || plan?.trustees[0]?.phone || "—";

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-forest-deep">
            {sw ? "Kadi ya dharura" : "Emergency QR pocket card"}
          </h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">
            {sw
              ? "Chapisha, kata, weka kwenye pochi. Familia iliyo na kadi inaweza kuskani QR."
              : "Print, cut, and keep in a wallet. Family with the card can scan the QR in an emergency."}
          </p>
        </div>
        <PrintButton>{sw ? "Chapisha kadi" : "Print this card"}</PrintButton>
      </div>

      <article className="mx-auto max-w-md rounded-[0.45rem] border-2 border-[#0B1D3A] bg-white p-6 print:border print:shadow-none">
        <p className="brand-font text-xl font-semibold text-forest-deep">ShambaTrust</p>
        <p className="text-sm uppercase tracking-wide text-brass">
          {sw ? "Kadi ya dharura" : "In case of emergency"}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">{owner?.fullName}</h2>
        {owner?.county ? <p className="text-muted">{owner.county}</p> : null}
        <div
          className="mx-auto my-4 w-44"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
        <dl className="space-y-2 text-base">
          <div>
            <dt className="font-semibold text-muted">{sw ? "Mtu wa dharura" : "Primary contact"}</dt>
            <dd>{contact} · {phone}</dd>
          </div>
          {advocate ? (
            <div>
              <dt className="font-semibold text-muted">{sw ? "Wakili" : "Lawyer"}</dt>
              <dd>
                {advocate.fullName}
                {advocate.advocateLicense ? ` · LSK ${advocate.advocateLicense}` : ""}
              </dd>
            </div>
          ) : null}
          {vault.physicalDocumentLocation ? (
            <div>
              <dt className="font-semibold text-muted">{sw ? "Nyaraka" : "Paper originals"}</dt>
              <dd>{vault.physicalDocumentLocation}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-4 text-xs text-muted">Scan: {url}</p>
      </article>

      <p className="print:hidden">
        <Link href="/vault" className="font-semibold text-forest underline">
          {sw ? "Rudi kwenye hifadhi" : "Back to vault"}
        </Link>
      </p>
    </div>
  );
}
