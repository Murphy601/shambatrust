import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  findUserById,
  findVaultByEmergencyToken,
  getExecutionPlan,
  listReviewRequests,
} from "@/lib/db/store";

type Params = { params: Promise<{ token: string }> };

export default async function EmergencyPublicPage({ params }: Params) {
  const { token } = await params;
  const vault = await findVaultByEmergencyToken(token);
  if (!vault) {
    return (
      <>
        <SiteHeader />
        <main className="section py-16">
          <h1 className="text-3xl font-semibold text-forest-deep">Card not found</h1>
          <p className="mt-3 text-lg text-muted">This emergency card is not valid.</p>
        </main>
        <SiteFooter />
      </>
    );
  }

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
  const contact =
    vault.emergencyPrimaryContactName ||
    plan?.trustees[0]?.fullName ||
    vault.burialWishes?.committeeLead1 ||
    "Not listed";
  const phone =
    vault.emergencyPrimaryContactPhone || plan?.trustees[0]?.phone || "";

  return (
    <>
      <SiteHeader />
      <main className="section py-12">
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-brass">
          Emergency
        </p>
        <h1 className="brand-font mt-2 text-4xl font-semibold text-forest-deep">
          {owner?.fullName || "ShambaTrust elder"}
        </h1>
        {owner?.county ? <p className="mt-1 text-lg text-muted">{owner.county}</p> : null}
        <div className="mt-8 space-y-4 rounded-[0.45rem] border-2 border-border bg-surface p-6 text-lg">
          <p>
            <span className="block text-sm font-semibold uppercase text-muted">
              Primary contact
            </span>
            {contact}
            {phone ? ` · ${phone}` : ""}
          </p>
          {vault.emergencyMedicalNotes ? (
            <p>
              <span className="block text-sm font-semibold uppercase text-muted">
                Medical directives
              </span>
              {vault.emergencyMedicalNotes}
            </p>
          ) : null}
          {advocate ? (
            <p>
              <span className="block text-sm font-semibold uppercase text-muted">
                Lawyer
              </span>
              {advocate.fullName}
              {advocate.advocateLicense ? ` · LSK ${advocate.advocateLicense}` : ""}
              {advocate.phone ? ` · ${advocate.phone}` : ""}
            </p>
          ) : null}
          {vault.physicalDocumentLocation ? (
            <p>
              <span className="block text-sm font-semibold uppercase text-muted">
                Paper originals
              </span>
              {vault.physicalDocumentLocation}
            </p>
          ) : null}
        </div>
        <p className="mt-6 text-sm text-muted">
          This card shows emergency contacts only. It does not open the vault or land titles.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
