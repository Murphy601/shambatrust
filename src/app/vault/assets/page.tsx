"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { vaultCopy } from "@/lib/vault-copy";
import { assetSummary, nomineeTotal, parcelIdentifiers } from "@/lib/asset-fields";
import type { Asset } from "@/lib/db/types";

export default function AssetsPage() {
  const { locale } = useLocale();
  const t = vaultCopy(locale);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [locked, setLocked] = useState(false);
  const [amendmentOpen, setAmendmentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/vault/assets");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load assets");
      return;
    }
    setAssets(data.assets);
    setLocked(Boolean(data.locked));
    setAmendmentOpen(Boolean(data.amendmentOpen));
  }

  useEffect(() => {
    void load();
  }, []);

  async function remove(id: string) {
    if (locked) return;
    if (!confirm(locale === "sw" ? "Futa mali hii?" : "Delete this asset?")) return;
    const res = await fetch(`/api/vault/assets/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not delete");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-forest-deep">{t.assets}</h1>
          <p className="mt-2 text-lg text-muted">
            {locale === "sw"
              ? "Orodhesha mashamba, magari, akaunti, na biashara."
              : "Catalog land, vehicles, accounts, and businesses."}
          </p>
          <p className="mt-2 text-base font-medium text-forest">
            {locked
              ? t.submittedBanner
              : amendmentOpen
                ? t.amendmentBanner
                : t.draftBanner}
          </p>
        </div>
        {!locked && (
          <Link href="/vault/assets/new" className="btn btn-primary">
            {t.addAsset}
          </Link>
        )}
      </div>

      {error && (
        <p className="text-base font-medium text-[var(--danger)]">{error}</p>
      )}

      {assets.length === 0 ? (
        <div className="rounded-[0.45rem] border-2 border-border bg-surface p-6">
          <p className="text-lg text-ink">{t.emptyAssets}</p>
          {!locked && (
            <Link href="/vault/assets/new" className="btn btn-brass mt-5">
              {t.addAsset}
            </Link>
          )}
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="rounded-[0.45rem] border-2 border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-brass">
                      {t.assetTypes[asset.type]}
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold text-forest-deep">
                      {asset.title}
                    </h2>
                    <p className="mt-2 text-base text-muted">
                      {assetSummary(asset, locale)}
                    </p>
                    {parcelIdentifiers(asset, locale).length > 0 && (
                      <dl className="mt-3 grid gap-x-4 gap-y-1 text-base sm:grid-cols-2">
                        {parcelIdentifiers(asset, locale).map((row) => (
                          <div key={row.label} className="flex gap-2">
                            <dt className="font-semibold text-ink">{row.label}:</dt>
                            <dd className="text-muted">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {asset.type === "sacco" && asset.saccoNominees.length > 0 && (
                      <div className="mt-3">
                        <p className="text-base font-semibold text-ink">
                          {locale === "sw" ? "Wateule" : "Nominees"} (
                          {nomineeTotal(asset.saccoNominees)}%)
                        </p>
                        <ul className="mt-1 space-y-1 text-base text-muted">
                          {asset.saccoNominees.map((nominee) => (
                            <li key={nominee.id}>
                              {nominee.fullName}
                              {nominee.relationship
                                ? ` — ${nominee.relationship}`
                                : ""}{" "}
                              · {nominee.percentage}%
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {asset.documentName && (
                      <p className="mt-1 text-base text-forest">
                        Document: {asset.documentName}
                      </p>
                    )}
                    {asset.gpsLat != null && asset.gpsLng != null && (
                      <p className="mt-1 text-base">
                        <a
                          className="font-semibold text-forest underline"
                          href={`https://www.google.com/maps?q=${asset.gpsLat},${asset.gpsLng}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {locale === "sw" ? "Ramani ya GPS" : "GPS map pin"}
                        </a>
                      </p>
                    )}
                    {(asset.disputeFlag || asset.familyAlert) && (
                      <p className="mt-2 font-semibold text-[var(--danger)]">
                        {asset.disputeFlag
                          ? locale === "sw"
                            ? "Mzozo / caveat"
                            : "Dispute / caveat"
                          : locale === "sw"
                            ? "Onyo la familia"
                            : "Family alert"}
                        {asset.disputeNotes ? ` — ${asset.disputeNotes}` : ""}
                      </p>
                    )}
                  </div>
                  {!locked && (
                    <button
                      type="button"
                      className="btn btn-secondary-dark"
                      onClick={() => void remove(asset.id)}
                    >
                      {t.delete}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!locked && (
            <div className="flex flex-wrap gap-3">
              <Link href="/vault/assets/new" className="btn btn-secondary-dark">
                {t.addAnotherAsset}
              </Link>
              <Link href="/vault/heirs" className="btn btn-primary">
                {t.continueHeirs}
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
