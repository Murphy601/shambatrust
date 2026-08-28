import type { ChecklistItem, PackageTier } from "@/lib/db/types";

const CORE_ITEMS: ChecklistItem[] = [
    {
      key: "title_deed_readable",
      label: "Title deed / asset documents are readable",
      done: false,
      notes: "",
    },
    {
      key: "heirs_identity_clear",
      label: "Heir identities and contacts are clear",
      done: false,
      notes: "",
    },
    {
      key: "allocations_consistent",
      label: "Allocations are consistent with listed assets",
      done: false,
      notes: "",
    },
    {
      key: "identity_match",
      label: "Client identity verified (ID / conversation)",
      done: false,
      notes: "",
    },
];

const PACKAGE_ITEMS: Record<PackageTier, ChecklistItem[]> = {
  vault: [
    {
      key: "will_scope_ok",
      label: "Will scope and executor instructions agreed",
      done: false,
      notes: "",
    },
  ],
  standard: [
    {
      key: "title_registry_checked",
      label: "Official ArdhiSasa search certificate reviewed",
      done: false,
      notes: "",
    },
    {
      key: "will_trust_scope_ok",
      label: "Will and land trust scope agreed",
      done: false,
      notes: "",
    },
  ],
  premium: [
    {
      key: "title_registry_checked",
      label: "Official ArdhiSasa search certificate reviewed",
      done: false,
      notes: "",
    },
    {
      key: "will_trust_poa_scope_ok",
      label: "Will, land trust, and POA scope agreed",
      done: false,
      notes: "",
    },
    {
      key: "trustees_confirmed",
      label: "Trustees and succession instructions confirmed",
      done: false,
      notes: "",
    },
    {
      key: "premium_consult_complete",
      label: "Premium consultation completed",
      done: false,
      notes: "",
    },
  ],
};

export function checklistForPackage(tier: PackageTier): ChecklistItem[] {
  return [...CORE_ITEMS, ...PACKAGE_ITEMS[tier]].map((item) => ({ ...item }));
}

export function defaultChecklist(): ChecklistItem[] {
  return checklistForPackage("standard");
}

export function checklistComplete(items: ChecklistItem[]): boolean {
  return items.length > 0 && items.every((item) => item.done);
}
