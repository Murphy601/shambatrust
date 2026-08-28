import { isLandLike } from "@/lib/asset-fields";
import type { Asset, Beneficiary, User, Vault } from "@/lib/db/types";
import { emptyIntakeDraft, type IntakeDraft } from "@/lib/intake/types";
import { mergeIntakeDraft } from "@/lib/intake/extract";

export function seedIntakeDraft(input: {
  owner: User | null | undefined;
  vault: Vault;
  assets: Asset[];
  beneficiaries: Beneficiary[];
}): IntakeDraft {
  const { owner, vault, assets, beneficiaries } = input;
  const spouse = beneficiaries.find((b) =>
    /spouse|wife|husband|mke|mume/i.test(b.relationship),
  );
  const heirs = beneficiaries
    .filter((b) => !spouse || b.id !== spouse.id)
    .map((b) => b.fullName)
    .filter(Boolean);
  const land = assets.find((a) => isLandLike(a.type) && a.titleNumber.trim()) ||
    assets.find((a) => isLandLike(a.type));
  const sacco = assets.find((a) => a.type === "sacco" && a.saccoName.trim());
  const bank = assets.find((a) => a.type === "bank_account" && a.bankName.trim());
  const mpesa = assets.find((a) => a.mpesaNumber.trim()) ||
    assets.find((a) => /m-?pesa/i.test(a.title));
  const business = assets.find((a) => a.kraPin.trim());

  return mergeIntakeDraft(emptyIntakeDraft(), {
    fullName: owner?.fullName || vault.willDraft?.testatorName || "",
    nationalId:
      owner?.diasporaNationalId || vault.willDraft?.testatorId || "",
    kraPin: business?.kraPin || "",
    spouseName: spouse?.fullName || "",
    heirs,
    trusteeName:
      vault.trustDraft?.primaryTrustee || vault.willDraft?.executorName || "",
    shambaLocation: land
      ? [land.landmark, land.county].filter(Boolean).join(", ")
      : "",
    lrNumber: land?.titleNumber || "",
    county: land?.county || owner?.county || "",
    saccoName: sacco?.saccoName || "",
    saccoMemberNumber: sacco?.saccoMemberNumber || "",
    bankName: bank?.bankName || "",
    accountNumber: bank?.accountNumber || "",
    mpesaNumber: mpesa?.mpesaNumber || "",
    documentName: land?.documentName || "",
    documentPath: land?.documentPath || "",
  });
}
