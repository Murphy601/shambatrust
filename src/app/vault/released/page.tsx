"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { formatDuration } from "@/lib/audio";
import type { Allocation, SaccoNominee } from "@/lib/db/types";

type Release = { caseId: string; vaultId: string; ownerName: string };

type Dossier = {
  case: {
    id: string;
    deathDate: string;
    vaultReleasedAt: string;
    releaseNotes: string;
  };
  owner: { fullName: string; county: string } | null;
  assets: Array<{
    id: string;
    type: string;
    title: string;
    summary: string;
    saccoNominees: SaccoNominee[];
  }>;
  beneficiaries: Array<{ id: string; fullName: string; relationship: string }>;
  allocations: Allocation[];
  documents: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    signatureName: string | null;
    signedAt: string | null;
    stampRef: string | null;
    stampAdvocateName: string;
    stampLskNumber: string;
    stampedAt: string | null;
  }>;
  testaments: Array<{
    id: string;
    title: string;
    languageLabel: string;
    durationSeconds: number | null;
    transcript: string;
    transcriptStatus: string;
  }>;
};

export default function ReleasedVaultPage() {
  const { locale } = useLocale();
  const sw = locale === "sw";

  const [releases, setReleases] = useState<Release[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listRes = await fetch("/api/succession/release", { method: "POST" });
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.error || "Failed to load.");

      const list: Release[] = listData.releases || [];
      setReleases(list);

      const caseId = selected || list[0]?.caseId || "";
      if (!caseId) {
        setDossier(null);
        setSelected("");
        return;
      }
      setSelected(caseId);

      const res = await fetch(`/api/succession/release?caseId=${caseId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load.");
      setDossier(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-forest-deep">
          {sw ? "Hifadhi iliyofunguliwa" : "Released vault"}
        </h1>
        <p className="mt-2 max-w-2xl text-lg text-muted">
          {sw
            ? "Baada ya amana na walezi kuthibitisha na ShambaTrust kuhakiki, watekelezaji walioteuliwa wanaweza kusoma jalada lililotiwa muhuri hapa."
            : "Once trustees and guardians have confirmed and ShambaTrust has verified the claim, appointed executors can read the sealed dossier here."}
        </p>
      </div>

      {error && <p className="text-base font-medium text-[var(--danger)]">{error}</p>}
      {loading && <p className="text-lg text-muted">Loading…</p>}

      {!loading && releases.length === 0 && (
        <p className="rounded-[0.45rem] border-2 border-border bg-surface p-6 text-lg text-muted">
          {sw
            ? "Hakuna hifadhi iliyofunguliwa kwako. Hifadhi hufunguliwa tu baada ya hatua zote za uthibitisho kukamilika."
            : "No vault has been released to you. Access is only opened after every verification step has passed."}
        </p>
      )}

      {releases.length > 1 && (
        <div className="max-w-md">
          <label className="field-label" htmlFor="releasePick">
            {sw ? "Chagua hifadhi" : "Choose a vault"}
          </label>
          <select
            id="releasePick"
            className="field"
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              setDossier(null);
            }}
          >
            {releases.map((release) => (
              <option key={release.caseId} value={release.caseId}>
                {release.ownerName}
              </option>
            ))}
          </select>
        </div>
      )}

      {dossier && (
        <>
          <section className="rounded-[0.45rem] border-2 border-forest bg-[color-mix(in_srgb,var(--forest)_8%,white)] p-5 sm:p-7">
            <h2 className="text-2xl font-semibold text-forest-deep">
              {dossier.owner?.fullName || (sw ? "Mzee" : "Elder")}
            </h2>
            <p className="mt-2 text-base text-ink">
              {sw ? "Kifo" : "Date of death"}: {dossier.case.deathDate} ·{" "}
              {sw ? "Ilifunguliwa" : "Released"}{" "}
              {new Date(dossier.case.vaultReleasedAt).toLocaleString()}
            </p>
            {dossier.case.releaseNotes && (
              <p className="mt-2 text-base text-muted">
                {dossier.case.releaseNotes}
              </p>
            )}
          </section>

          <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
            <h2 className="text-2xl font-semibold text-forest-deep">
              {sw ? "Nyaraka zilizothibitishwa" : "Certified instruments"}
            </h2>
            {dossier.documents.length === 0 ? (
              <p className="mt-3 text-lg text-muted">
                {sw ? "Hakuna nyaraka." : "No certified instruments on file."}
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {dossier.documents.map((doc) => (
                  <li key={doc.id} className="border-l-4 border-brass pl-3">
                    <p className="text-lg font-semibold text-ink">{doc.title}</p>
                    <p className="text-base text-muted capitalize">
                      {doc.type.replace(/_/g, " ")} · {doc.status}
                      {doc.signatureName ? ` · signed by ${doc.signatureName}` : ""}
                    </p>
                    {doc.stampRef && (
                      <p className="mt-1 text-base text-forest">
                        {sw ? "Muhuri" : "Legal stamp"} {doc.stampRef} ·{" "}
                        {doc.stampAdvocateName}
                        {doc.stampLskNumber ? ` (LSK ${doc.stampLskNumber})` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
            <h2 className="text-2xl font-semibold text-forest-deep">
              {sw ? "Mali" : "Assets"}
            </h2>
            <ul className="mt-4 space-y-3">
              {dossier.assets.map((asset) => (
                <li key={asset.id} className="border-l-4 border-forest pl-3">
                  <p className="text-lg font-semibold text-ink">{asset.title}</p>
                  <p className="text-base text-muted">{asset.summary}</p>
                  {asset.saccoNominees.length > 0 && (
                    <ul className="mt-1 text-base text-muted">
                      {asset.saccoNominees.map((nominee) => (
                        <li key={nominee.id}>
                          {nominee.fullName} · {nominee.percentage}%
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
            <h2 className="text-2xl font-semibold text-forest-deep">
              {sw ? "Warithi na ugawaji" : "Heirs and allocations"}
            </h2>
            <ul className="mt-4 space-y-2">
              {dossier.beneficiaries.map((heir) => {
                const shares = dossier.allocations.filter(
                  (allocation) => allocation.beneficiaryId === heir.id,
                );
                return (
                  <li key={heir.id} className="text-base">
                    <span className="font-semibold text-ink">
                      {heir.fullName}
                    </span>{" "}
                    — {heir.relationship}
                    {shares.length > 0 && (
                      <ul className="mt-1 pl-4 text-muted">
                        {shares.map((share) => {
                          const asset = dossier.assets.find(
                            (a) => a.id === share.assetId,
                          );
                          return (
                            <li key={share.id}>
                              {asset?.title || share.specificGift || "Estate"}
                              {share.percentage != null
                                ? ` — ${share.percentage}%`
                                : ""}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {dossier.testaments.length > 0 && (
            <section className="rounded-[0.45rem] border-2 border-border bg-surface p-5 sm:p-7">
              <h2 className="text-2xl font-semibold text-forest-deep">
                {sw ? "Wosia wa sauti" : "Voice testaments"}
              </h2>
              <ul className="mt-4 space-y-4">
                {dossier.testaments.map((testament) => (
                  <li
                    key={testament.id}
                    className="rounded-[0.35rem] border border-border p-4"
                  >
                    <p className="text-lg font-semibold text-ink">
                      {testament.title}
                    </p>
                    <p className="text-base text-muted">
                      {testament.languageLabel} ·{" "}
                      {formatDuration(testament.durationSeconds)}
                    </p>
                    <audio
                      className="mt-3 w-full"
                      controls
                      preload="none"
                      src={`/api/vault/testaments/${testament.id}/audio`}
                    />
                    {testament.transcript && (
                      <p className="mt-3 whitespace-pre-wrap text-base text-ink">
                        {testament.transcript}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
