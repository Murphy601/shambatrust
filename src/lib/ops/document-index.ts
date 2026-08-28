import {
  getLatestVaultBinder,
  listAssets,
  listAllocations,
  listAudioTestaments,
  listBeneficiaries,
  listEldersNewestFirst,
  listLegalDocuments,
  listReviewRequests,
  listTitleLookups,
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
  idOnFile: boolean;
  assetsNote: string;
  opsNotes: string;
  reviewNotes: string;
  familyNote: string;
  willDraft: boolean;
  trustDraft: boolean;
  burialWishes: boolean;
  gpsPinned: number;
  disputeCount: number;
  testamentCount: number;
  allocationCount: number;
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
    let fileCount = 0;
    let searchHay = `${user.fullName} ${user.phone} ${user.county} ${user.address} ${vault?.id || ""} ${vault?.status || ""}`;
    const pending: OpsFileRow[] = [];

    const pushKyc = (
      slot: "idFront" | "idBack",
      title: string,
      path: string | null,
      name: string | null,
    ) => {
      if (!path) return;
      fileCount += 1;
      pending.push({
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

    const matchesQuery = (hay: string) => {
      if (!q) return true;
      const digits = q.replace(/\D/g, "");
      return hay.toLowerCase().includes(q) || Boolean(digits && user.phone.includes(digits));
    };

    if (vault) {
      const [assets, legalDocs, reviews, binders, testaments, heirs, allocations, lookups] = await Promise.all([
        listAssets(vault.id),
        listLegalDocuments(vault.id),
        listReviewRequests(vault.id),
        listVaultBinders(vault.id),
        listAudioTestaments(vault.id),
        listBeneficiaries(vault.id),
        listAllocations(vault.id),
        listTitleLookups(vault.id),
      ]);
      const reviewId = [...reviews].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )[0]?.id;

      for (const asset of assets) {
        searchHay += ` ${asset.title} ${asset.titleNumber} ${asset.parcelNumber} ${asset.kraPin} ${asset.saccoName} ${asset.mpesaNumber} ${asset.documentName || ""}`;
        if (!asset.documentPath) continue;
        fileCount += 1;
        const view = reviewId
          ? `/api/secure-docs/view?kind=asset&reviewId=${reviewId}&assetId=${asset.id}`
          : `/api/secure-docs/view?kind=asset&vaultId=${vault.id}&assetId=${asset.id}`;
        pending.push({
          key: `asset:${asset.id}`,
          elderId: user.id,
          elderName: user.fullName,
          phone: user.phone,
          vaultId: vault.id,
          title: asset.documentName || asset.title,
          type: asset.titleNumber
            ? `${asset.type.replace(/_/g, " ")} · ${asset.titleNumber}`
            : asset.type.replace(/_/g, " "),
          source: "Asset vault intake",
          uploadedAt: asset.createdAt,
          status: "On file",
          viewUrl: view,
          downloadUrl: view,
        });
      }

      for (const doc of legalDocs) {
        searchHay += ` ${doc.title} ${doc.type}`;
        if (!doc.documentPath) continue;
        fileCount += 1;
        pending.push({
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

      for (const lookup of lookups) {
        searchHay += ` ${lookup.titleNumber} ${lookup.parcelNumber} ${lookup.documentName || ""}`;
        if (!lookup.documentPath) continue;
        fileCount += 1;
        pending.push({
          key: `title_search:${lookup.id}`,
          elderId: user.id,
          elderName: user.fullName,
          phone: user.phone,
          vaultId: vault.id,
          title: lookup.documentName || `ArdhiSasa search · ${lookup.titleNumber || lookup.parcelNumber}`,
          type: "ArdhiSasa official search",
          source: "LSK advocate filing",
          uploadedAt: lookup.certificateUploadedAt || lookup.updatedAt || lookup.createdAt,
          status: lookup.status.replace(/_/g, " "),
          viewUrl: `/api/secure-docs/view?kind=title_search&lookupId=${lookup.id}`,
          downloadUrl: `/api/secure-docs/view?kind=title_search&lookupId=${lookup.id}`,
        });
      }

      for (const testament of testaments) {
        searchHay += ` ${testament.title}`;
        fileCount += 1;
        pending.push({
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
        pending.push({
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
      const latestReview = [...reviews].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )[0];
      searchHay += ` ${heirs.map((h) => `${h.fullName} ${h.idNumber}`).join(" ")} ${vault.opsNotes} ${latestReview?.notes || ""}`;
      if (!matchesQuery(searchHay)) continue;
      files.push(...pending);
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
        idOnFile: Boolean(user.idFrontPath || user.idBackPath),
        assetsNote: assets
          .map((asset) =>
            [asset.title, asset.titleNumber, asset.parcelNumber]
              .filter(Boolean)
              .join(" · "),
          )
          .filter(Boolean)
          .join("; ") || "No assets listed",
        opsNotes: vault.opsNotes || "",
        reviewNotes: latestReview?.notes || "",
        familyNote:
          heirs
            .map((heir) => `${heir.fullName} (${heir.relationship || "heir"})`)
            .join("; ") || "No heirs named",
        willDraft: Boolean(vault.willDraft),
        trustDraft: Boolean(vault.trustDraft),
        burialWishes: Boolean(vault.burialWishes),
        gpsPinned: assets.filter((a) => a.gpsLat != null && a.gpsLng != null).length,
        disputeCount: assets.filter((a) => a.disputeFlag || a.familyAlert).length,
        testamentCount: testaments.length,
        allocationCount: allocations.length,
      });
    } else if (matchesQuery(searchHay)) {
      files.push(...pending);
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
        idOnFile: Boolean(user.idFrontPath || user.idBackPath),
        assetsNote: "No vault yet",
        opsNotes: "",
        reviewNotes: "",
        familyNote: "No heirs named",
        willDraft: false,
        trustDraft: false,
        burialWishes: false,
        gpsPinned: 0,
        disputeCount: 0,
        testamentCount: 0,
        allocationCount: 0,
      });
    }
  }

  files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  return { files, dossiers };
}
