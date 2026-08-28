import { isLandLike } from "@/lib/asset-fields";
import type {
  Asset,
  BurialWishes,
  TrustDraft,
  User,
  Vault,
  WillDraft,
} from "@/lib/db/types";
import {
  addAudit,
  listAssets,
  listBeneficiaries,
  saveAsset,
  saveBeneficiary,
  saveBurialWishes,
  saveTrustDraft,
  saveWillDraft,
  updateElderIdentity,
} from "@/lib/db/store";
import { extractCounty } from "@/lib/intake/extract";
import type { IntakeDraft } from "@/lib/intake/types";

function namesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function blankWill(): Omit<WillDraft, "updatedAt"> {
  return {
    testatorName: "",
    testatorId: "",
    primaryResidence: "",
    executorName: "",
    executorPhone: "",
    altExecutorName: "",
    altExecutorPhone: "",
    guardianName: "",
    guardianPhone: "",
    altGuardianName: "",
    witnessAcknowledged: false,
    notes: "",
    testamentaryTrustEnabled: false,
    testamentaryTrustTerms: "",
    testamentaryTrustUntilAge: 18,
    over75OrFrail: false,
    medicalCapacityAttached: false,
    medicalCapacityDocumentName: null,
    medicalCapacityDocumentPath: null,
    medicalCapacityUploadedAt: null,
    disinheritanceExplanation: "",
  };
}

function blankTrust(): Omit<TrustDraft, "updatedAt"> {
  return {
    trustName: "",
    primaryTrustee: "",
    coTrustee: "",
    titleNumbers: "",
    conditions: "",
    enforcerName: "",
    enforcerPhone: "",
    enforcerIdNumber: "",
    enforcerOrganization: "",
    minCoSignApprovals: 2,
    over75OrFrail: false,
    medicalCapacityAttached: false,
    medicalCapacityDocumentName: null,
    medicalCapacityDocumentPath: null,
    medicalCapacityUploadedAt: null,
  };
}

function blankBurial(): Omit<BurialWishes, "updatedAt"> {
  return {
    burialLocation: "undecided",
    burialDetails: "",
    committeeLead1: "",
    committeeLead2: "",
    specialMessage: "",
    burialPlotTitle: "",
    burialGpsLat: null,
    burialGpsLng: null,
    clanEldersToInvolve: "",
    culturalTraditions: "",
    saccoNomineeName: "",
    saccoNomineePhone: "",
    saccoAccount: "",
    mpesaNomineePhone: "",
    insurancePolicyRef: "",
    liquidityNotes: "",
  };
}

function assetShell(
  vaultId: string,
  type: Asset["type"],
  title: string,
): Omit<Asset, "id" | "createdAt" | "updatedAt" | "saccoNominees"> & {
  saccoNominees: Asset["saccoNominees"];
} {
  return {
    vaultId,
    type,
    title,
    notes: "Captured during Amani guided intake.",
    documentName: null,
    documentPath: null,
    titleNumber: "",
    county: "",
    subCounty: "",
    landmark: "",
    gpsLat: null,
    gpsLng: null,
    parcelNumber: "",
    blockNumber: "",
    registrationSection: "",
    landRegistryOffice: "",
    landOwnershipType: "",
    registrationNumber: "",
    makeModel: "",
    year: "",
    bankName: "",
    accountNumber: "",
    accountType: "",
    businessRegNumber: "",
    kraPin: "",
    saccoName: "",
    saccoMemberNumber: "",
    saccoNominees: [],
    mpesaNumber: "",
    disputeFlag: false,
    disputeNotes: "",
    familyAlert: false,
  };
}

export type IntakeCommitResult = {
  saved: string[];
  skippedHeirs: boolean;
};

export async function commitIntakeDraft(input: {
  vault: Vault;
  actorUserId: string;
  asAgent: boolean;
  draft: IntakeDraft;
  owner: User;
}): Promise<IntakeCommitResult> {
  const saved: string[] = [];
  const { vault, draft, asAgent, actorUserId, owner } = input;

  const identity = await updateElderIdentity({
    userId: vault.ownerId,
    fullName: draft.fullName,
    nationalId: draft.nationalId,
  });
  if (identity) saved.push("identity");

  const assets = await listAssets(vault.id);
  const heirs = await listBeneficiaries(vault.id);

  let skippedHeirs = false;
  if (!asAgent) {
    if (draft.spouseName.trim()) {
      const existing = heirs.find(
        (h) =>
          namesEqual(h.fullName, draft.spouseName) ||
          h.relationship.toLowerCase().includes("spouse") ||
          h.relationship.toLowerCase().includes("mke") ||
          h.relationship.toLowerCase().includes("mume"),
      );
      if (!existing) {
        await saveBeneficiary({
          vaultId: vault.id,
          fullName: draft.spouseName.trim(),
          idNumber: "",
          phone: "",
          relationship: "spouse",
          dateOfBirth: "",
          houseId: null,
        });
        saved.push("spouse");
      }
    }
    for (const name of draft.heirs) {
      if (!name.trim()) continue;
      if (draft.spouseName && namesEqual(name, draft.spouseName)) continue;
      const existing = heirs.find((h) => namesEqual(h.fullName, name));
      if (existing) continue;
      await saveBeneficiary({
        vaultId: vault.id,
        fullName: name.trim(),
        idNumber: "",
        phone: "",
        relationship: "child",
        dateOfBirth: "",
        houseId: null,
      });
      saved.push(`heir:${name.trim()}`);
    }
  } else if (draft.spouseName.trim() || draft.heirs.length > 0) {
    skippedHeirs = true;
  }

  const county =
    draft.county.trim() ||
    extractCounty(draft.shambaLocation) ||
    owner.county ||
    "";
  if (draft.lrNumber.trim() || draft.shambaLocation.trim()) {
    const existingLand =
      assets.find(
        (a) =>
          isLandLike(a.type) &&
          draft.lrNumber &&
          namesEqual(a.titleNumber, draft.lrNumber),
      ) ||
      assets.find(
        (a) =>
          isLandLike(a.type) &&
          draft.shambaLocation &&
          namesEqual(a.landmark, draft.shambaLocation),
      ) ||
      assets.find((a) => isLandLike(a.type) && !a.titleNumber.trim());
    const base = existingLand
      ? { ...existingLand }
      : assetShell(
          vault.id,
          "land",
          draft.shambaLocation.trim() || draft.lrNumber.trim() || "Family shamba",
        );
    const landTitle = [
      existingLand?.title && !/shamba langu liko/i.test(existingLand.title)
        ? existingLand.title
        : "",
      draft.county || county,
      draft.lrNumber.trim(),
    ]
      .filter(Boolean)
      .filter((part, i, arr) => arr.indexOf(part) === i)
      .join(" ")
      .trim() || "Family shamba";
    await saveAsset({
      ...base,
      id: existingLand?.id,
      vaultId: vault.id,
      type: "land",
      title: landTitle,
      titleNumber: existingLand?.titleNumber || draft.lrNumber.trim(),
      county: existingLand?.county || county,
      landmark:
        existingLand?.landmark ||
        draft.shambaLocation.trim() ||
        draft.plotSize.trim(),
      notes: [
        existingLand?.notes,
        draft.plotSize ? `Plot size: ${draft.plotSize}` : "",
        existingLand ? "" : "Captured during Amani guided intake.",
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
      documentName: existingLand?.documentName || draft.documentName || null,
      documentPath: existingLand?.documentPath || draft.documentPath || null,
    });
    saved.push("land");
  }

  if (draft.saccoName.trim()) {
    const existing =
      assets.find(
        (a) => a.type === "sacco" && namesEqual(a.saccoName, draft.saccoName),
      ) || assets.find((a) => a.type === "sacco" && !a.saccoName.trim());
    const base = existing
      ? { ...existing }
      : assetShell(vault.id, "sacco", draft.saccoName.trim());
    await saveAsset({
      ...base,
      id: existing?.id,
      vaultId: vault.id,
      type: "sacco",
      title: draft.saccoName.trim(),
      saccoName: draft.saccoName.trim(),
      saccoMemberNumber:
        existing?.saccoMemberNumber || draft.saccoMemberNumber.trim(),
    });
    saved.push("sacco");
  }

  if (draft.bankName.trim()) {
    const existing =
      assets.find(
        (a) =>
          a.type === "bank_account" && namesEqual(a.bankName, draft.bankName),
      ) || assets.find((a) => a.type === "bank_account" && !a.bankName.trim());
    const base = existing
      ? { ...existing }
      : assetShell(vault.id, "bank_account", draft.bankName.trim());
    await saveAsset({
      ...base,
      id: existing?.id,
      vaultId: vault.id,
      type: "bank_account",
      title: draft.bankName.trim(),
      bankName: draft.bankName.trim(),
      accountNumber: existing?.accountNumber || draft.accountNumber.trim(),
    });
    saved.push("bank");
  }

  if (draft.mpesaNumber.trim() || draft.mpesaNominee.trim()) {
    const existing =
      assets.find((a) => a.type === "sacco" && a.mpesaNumber.trim()) ||
      assets.find((a) => /m-?pesa/i.test(a.title));
    const base = existing
      ? { ...existing }
      : assetShell(vault.id, "sacco", "M-Pesa");
    await saveAsset({
      ...base,
      id: existing?.id,
      vaultId: vault.id,
      type: "sacco",
      title: existing?.title || "M-Pesa",
      mpesaNumber: existing?.mpesaNumber || draft.mpesaNumber.trim(),
      notes: [
        existing?.notes,
        draft.mpesaNominee ? `Nominee: ${draft.mpesaNominee}` : "",
      ]
        .filter(Boolean)
        .join(" ")
        .trim(),
    });
    saved.push("mpesa");
  }

  if (draft.kraPin.trim()) {
    const existing =
      assets.find((a) => a.type === "business" && a.kraPin.trim() === draft.kraPin.trim()) ||
      assets.find((a) => a.type === "business" && !a.kraPin.trim());
    if (existing) {
      if (!existing.kraPin.trim()) {
        await saveAsset({
          ...existing,
          id: existing.id,
          vaultId: vault.id,
          kraPin: draft.kraPin.trim(),
        });
        saved.push("kraPin");
      }
    } else {
      await saveAsset({
        ...assetShell(vault.id, "other", "KRA PIN"),
        vaultId: vault.id,
        type: "other",
        kraPin: draft.kraPin.trim(),
        notes: "KRA PIN captured during Amani guided intake.",
      });
      saved.push("kraPin");
    }
  }

  if (draft.fullName.trim() || draft.nationalId.trim() || draft.trusteeName.trim()) {
    const current = vault.willDraft;
    const will = { ...(current ? { ...current } : blankWill()) };
    if (!will.testatorName.trim() && draft.fullName.trim()) {
      will.testatorName = draft.fullName.trim();
    }
    if (!will.testatorId.trim() && draft.nationalId.trim()) {
      will.testatorId = draft.nationalId.trim();
    }
    if (!will.executorName.trim() && draft.trusteeName.trim()) {
      will.executorName = draft.trusteeName.trim();
    }
    const { updatedAt: _ignore, ...willFields } = will as WillDraft;
    void _ignore;
    await saveWillDraft(vault.id, willFields);
    saved.push("will");
  }

  if (draft.trusteeName.trim()) {
    const current = vault.trustDraft;
    const trust = { ...(current ? { ...current } : blankTrust()) };
    if (!trust.primaryTrustee.trim()) trust.primaryTrustee = draft.trusteeName.trim();
    if (draft.lrNumber.trim() && !trust.titleNumbers.trim()) {
      trust.titleNumbers = draft.lrNumber.trim();
    }
    const { updatedAt: _ignore, ...trustFields } = trust as TrustDraft;
    void _ignore;
    await saveTrustDraft(vault.id, trustFields);
    saved.push("trust");
  }

  if (draft.mpesaNominee.trim() || draft.saccoName.trim()) {
    const current = vault.burialWishes;
    const wishes = { ...(current ? { ...current } : blankBurial()) };
    if (!wishes.saccoNomineeName.trim() && draft.mpesaNominee.trim()) {
      wishes.saccoNomineeName = draft.mpesaNominee.trim();
    }
    if (!wishes.saccoAccount.trim() && draft.saccoName.trim()) {
      wishes.saccoAccount = draft.saccoName.trim();
    }
    if (!wishes.mpesaNomineePhone.trim() && draft.mpesaNumber.trim()) {
      wishes.mpesaNomineePhone = draft.mpesaNumber.trim();
    }
    const { updatedAt: _ignore, ...wishFields } = wishes as BurialWishes;
    void _ignore;
    await saveBurialWishes(vault.id, wishFields);
    saved.push("wishes");
  }

  await addAudit({
    vaultId: vault.id,
    actorUserId,
    action: "intake_committed",
    detail: `Amani intake saved ${saved.length} items`,
  });

  return { saved, skippedHeirs };
}
