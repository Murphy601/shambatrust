import {
  getLatestVaultBinder,
  listAssets,
  listAudioTestaments,
  listEldersNewestFirst,
  listLegalDocuments,
  listReviewRequests,
  listVaultBinders,
} from "@/lib/db/store";

export type OpsFileRow = {
  key: string;
  elderId: string;
  elderName: string;
  phone: string;
  vaultId: string | null;
  title: string;
  type: string;
  source: string;
  uploadedAt: string;
  status: string;
  viewUrl: string | null;
  downloadUrl: string | null;
};

export type OpsDossierRow = {
  elderId: string;
  fullName: string;
  phone: string;
  county: string;
  address: string;
  vaultId: string | null;
  vaultStatus: string | null;
  packageTier: string | null;
  fileCount: number;
  heirsNote: string;
  latestBinderId: string | null;
  latestBinderStatus: string | null;
  inspectUrl: string | null;
};

export async function listOpsDocumentIndex(query = ""): Promise<{
  files: OpsFileRow[];
  dossiers: OpsDossierRow[];
}> {
  const q = query.trim().toLowerCase();
  const elders = await listEldersNewestFirst();
  const files: OpsFileRow[] = [];
  const dossiers: OpsDossierRow[] = [];

  for (const { user, vault } of elders) {
    const hay = `${user.fullName} ${user.phone} ${user.county} ${vault?.id || ""} ${vault?.status || ""}`.toLowerCase();
    if (q && !hay.includes(q) && !user.phone.includes(q.replace(/\D/g, ""))) {
      continue;
    }

    let fileCount = 0;

    const pushKyc = (
      slot: "idFront" | "idBack",
      title: string,
      path: string | null,
      name: string | null,
    ) => {
      if (!path) return;
      fileCount += 1;
      files.push({
        key: `${user.id}:${slot}`,
        elderId: user.id,
        elderName: user.fullName,
        phone: user.phone,
        vaultId: vault?.id || null,
        title: name || title,
        type: "National ID",
        source: "Initial onboarding",
        uploadedAt: user.createdAt,
        status: "On file",
        viewUrl: `/api/ops/documents/file?elderId=${user.id}&slot=${slot}&disposition=inline`,
        downloadUrl: `/api/ops/documents/file?elderId=${user.id}&slot=${slot}&disposition=attachment`,
      });
    };

    pushKyc("idFront", "National ID — front", user.idFrontPath, user.idFrontName);
    pushKyc("idBack", "National ID — back", user.idBackPath, user.idBackName);

    if (vault) {
      const [assets, legalDocs, reviews, binders, testaments] = await Promise.all([
        listAssets(vault.id),
        listLegalDocuments(vault.id),
        listReviewRequests(vault.id),
        listVaultBinders(vault.id),
        listAudioTestaments(vault.id),
      ]);
      const reviewId = [...reviews].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )[0]?.id;

      for (const asset of assets) {
        if (!asset.documentPath) continue;
        fileCount += 1;
        const view = reviewId
          ? `/api/secure-docs/view?kind=asset&reviewId=${reviewId}&assetId=${asset.id}`
          : `/api/secure-docs/view?kind=asset&vaultId=${vault.id}&assetId=${asset.id}`;
        files.push({
          key: `asset:${asset.id}`,
          elderId: user.id,
          elderName: user.fullName,
          phone: user.phone,
          vaultId: vault.id,
          title: asset.documentName || asset.title,
          type: asset.type.replace(/_/g, " "),
          source: "Asset vault intake",
          uploadedAt: asset.createdAt,
          status: "On file",
          viewUrl: view,
          downloadUrl: null,
        });
      }

      for (const doc of legalDocs) {
        if (!doc.documentPath) continue;
        fileCount += 1;
        files.push({
          key: `legal:${doc.id}`,
          elderId: user.id,
          elderName: user.fullName,
          phone: user.phone,
          vaultId: vault.id,
          title: doc.title,
          type: doc.type.replace(/_/g, " "),
          source: "Advocate instrument",
          uploadedAt: doc.updatedAt || doc.createdAt,
          status: doc.status.replace(/_/g, " "),
          viewUrl: reviewId
            ? `/api/secure-docs/view?kind=legal&reviewId=${reviewId}&documentId=${doc.id}`
            : null,
          downloadUrl: null,
        });
      }

      for (const testament of testaments) {
        fileCount += 1;
        files.push({
          key: `audio:${testament.id}`,
          elderId: user.id,
          elderName: user.fullName,
          phone: user.phone,
          vaultId: vault.id,
          title: testament.title,
          type: "Voice testament",
          source: "Voice recording",
          uploadedAt: testament.createdAt,
          status: testament.transcriptStatus.replace(/_/g, " "),
          viewUrl: `/ops/transcripts`,
          downloadUrl: null,
        });
      }

      for (const binder of binders) {
        if (!binder.documentPath) continue;
        fileCount += 1;
        files.push({
          key: `binder:${binder.id}`,
          elderId: user.id,
          elderName: user.fullName,
          phone: user.phone,
          vaultId: vault.id,
          title: binder.documentName,
          type: "Master dossier / sealed binder",
          source: "Sealed vault binder",
          uploadedAt: binder.completedAt || binder.createdAt,
          status: binder.status,
          viewUrl: null,
          downloadUrl: `/api/ops/binders/${binder.id}/download`,
        });
      }

      const latest = await getLatestVaultBinder(vault.id);
      dossiers.push({
        elderId: user.id,
        fullName: user.fullName,
        phone: user.phone,
        county: user.county || "—",
        address: user.address || "—",
        vaultId: vault.id,
        vaultStatus: vault.status,
        packageTier: vault.packageTier,
        fileCount,
        heirsNote: `${legalDocs.filter((d) => d.type === "will").length} will · ${legalDocs.filter((d) => d.type === "land_trust").length} trust · ${legalDocs.filter((d) => d.type === "poa").length} POA`,
        latestBinderId: latest?.id || null,
        latestBinderStatus: latest?.status || null,
        inspectUrl: `/ops/vaults/${vault.id}`,
      });
    } else {
      dossiers.push({
        elderId: user.id,
        fullName: user.fullName,
        phone: user.phone,
        county: user.county || "—",
        address: user.address || "—",
        vaultId: null,
        vaultStatus: null,
        packageTier: null,
        fileCount,
        heirsNote: "No vault yet",
        latestBinderId: null,
        latestBinderStatus: null,
        inspectUrl: null,
      });
    }
  }

  files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  return { files, dossiers };
}
