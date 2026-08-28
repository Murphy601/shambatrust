import Link from "next/link";
import { redirect } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import {
  TitleConsentParcels,
  type ConsentParcelDraft,
} from "@/components/title-consent-parcels";
import { readSession } from "@/lib/auth/session";
import {
  findUserById,
  getVaultForUser,
  listAssets,
  listTitleLookups,
} from "@/lib/db/store";
import { isLandLike } from "@/lib/asset-fields";
import {
  PAPER_AUTH_BODY_EN,
  PAPER_AUTH_BODY_SW,
  PAPER_AUTH_TITLE_EN,
  PAPER_AUTH_TITLE_SW,
} from "@/lib/land-registry/verification";

export default async function TitleConsentPrintPage() {
  const session = await readSession();
  if (!session) redirect("/login");
  const access = await getVaultForUser(session.userId);
  if (!access) redirect("/vault");

  const [owner, assets, lookups] = await Promise.all([
    findUserById(access.vault.ownerId),
    listAssets(access.vault.id),
    listTitleLookups(access.vault.id),
  ]);
  const land = assets.filter((a) => isLandLike(a.type));
  const sw = owner?.locale === "sw";
  const title = sw ? PAPER_AUTH_TITLE_SW : PAPER_AUTH_TITLE_EN;
  const body = sw ? PAPER_AUTH_BODY_SW : PAPER_AUTH_BODY_EN;
  const knownParcels: ConsentParcelDraft[] = [
    ...land.map((a) => ({
      titleNumber: a.titleNumber,
      parcelNumber: a.parcelNumber,
      blockNumber: a.blockNumber,
      registrationSection: a.registrationSection,
      county: a.landRegistryOffice || a.county,
    })),
    ...lookups
      .filter(
        (lu) =>
          !land.some(
            (a) =>
              a.titleNumber && lu.titleNumber && a.titleNumber === lu.titleNumber,
          ),
      )
      .map((lu) => ({
        titleNumber: lu.titleNumber,
        parcelNumber: lu.parcelNumber,
        blockNumber: lu.blockNumber,
        registrationSection: lu.registrationSection,
        county: lu.landRegistryOffice || lu.county,
      })),
  ].filter((row) =>
    [
      row.titleNumber,
      row.parcelNumber,
      row.blockNumber,
      row.registrationSection,
      row.county,
    ].some((value) => value.trim().length > 0),
  );

  return (
    <div className="space-y-6">
      <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-forest-deep">{title}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted">
            {sw
              ? "Chapisha ukurasa huu, saini kwa kalamu, kisha piga picha na upakie kwenye Diaspora / uthibitisho wa ardhi."
              : "Print this page, sign it in pen, then photograph it and upload it on Diaspora / land verification. A son or daughter can sit with you."}
          </p>
        </div>
        <PrintButton>{sw ? "Chapisha fomu" : "Print this page"}</PrintButton>
      </div>

      <article className="rounded-[0.45rem] border-2 border-border bg-white p-6 sm:p-10 print:border-0 print:p-0">
        <p className="brand-font text-2xl font-semibold text-forest-deep">ShambaTrust</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">{title}</h2>
        <p className="mt-4 whitespace-pre-line text-lg leading-relaxed text-ink">{body}</p>

        <dl className="mt-8 grid gap-3 text-base sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-muted">{sw ? "Jina la mmiliki" : "Owner name"}</dt>
            <dd className="border-b border-border py-2">{owner?.fullName || "________________"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted">{sw ? "Nambari ya ID" : "National ID"}</dt>
            <dd className="border-b border-border py-2">
              {owner?.diasporaNationalId || "________________"}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-muted">{sw ? "Simu" : "Phone"}</dt>
            <dd className="border-b border-border py-2">{owner?.phone || "________________"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-muted">{sw ? "Kaunti" : "County"}</dt>
            <dd className="border-b border-border py-2">{owner?.county || "________________"}</dd>
          </div>
        </dl>

        <TitleConsentParcels
          initial={knownParcels}
          locale={owner?.locale === "sw" ? "sw" : "en"}
        />

        <div className="mt-10 grid gap-8 sm:grid-cols-2">
          <p>
            <span className="font-semibold">{sw ? "Sahihi ya mmiliki" : "Owner signature"}</span>
            <span className="mt-10 block border-b border-ink">&nbsp;</span>
            <span className="mt-2 block text-sm text-muted">
              {sw ? "Tarehe" : "Date"}: _______________
            </span>
          </p>
          <p>
            <span className="font-semibold">
              {sw ? "Shahidi (mwanafamilia, si lazima)" : "Witness (family, optional)"}
            </span>
            <span className="mt-10 block border-b border-ink">&nbsp;</span>
            <span className="mt-2 block text-sm text-muted">
              {sw ? "Jina na simu" : "Name and phone"}: _______________
            </span>
          </p>
        </div>
      </article>

      <p className="print:hidden">
        <Link href="/vault/diaspora" className="font-semibold text-forest underline">
          {sw ? "Rudi kupakia fomu iliyosainiwa" : "Back to upload the signed form"}
        </Link>
      </p>
    </div>
  );
}
