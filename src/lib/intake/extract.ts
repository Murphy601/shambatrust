import { KENYA_COUNTIES } from "@/lib/kenya-counties";
import {
  emptyIntakeDraft,
  isSkipped,
  markSkipped,
  type IntakeDraft,
} from "@/lib/intake/types";

const SKIP_RE =
  /^(skip|ruka|sijui|si jui|hapana|none|no|bado|si lazima|not sure|don't know|dont know|n\/a|-)$/i;

const KRA_RE = /\b([A-Z]\d{9}[A-Z])\b/i;
const ID_RE = /\b(\d{7,8})\b/;
const LR_RE =
  /\b(?:l\.?\s*r\.?|title(?:\s*(?:deed|no\.?|number))?|hati(?:\s*miliki)?)\s*(?:no\.?|number|namba)?\s*[:.]?\s*([A-Z0-9][A-Z0-9/.\-]{2,})/i;
const LR_NAKED_RE = /\b(?:LR|IR|CR)[\s./-]*([A-Z0-9/.\-]{2,})\b/i;
const MPESA_RE = /\b(0(?:7|1)\d{8}|254(?:7|1)\d{8}|\+254(?:7|1)\d{8})\b/;

function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/g, "")
    .trim();
}

function looksLikeName(value: string): boolean {
  const v = cleanName(value);
  if (v.length < 3 || v.length > 80) return false;
  if (/\d/.test(v)) return false;
  if (SKIP_RE.test(v)) return false;
  return /[A-Za-z]/.test(v);
}

export function looksLikeSkip(text: string): boolean {
  return SKIP_RE.test(text.trim());
}

export function detectSwahili(text: string): boolean {
  return /\b(jina|namba|shamba|mke|mume|watoto|warithi|sacco|hati|ardhi|nakuru|karibu|asante|sijui|ruka|namba yangu|nina)\b/i.test(
    text,
  );
}

export function extractCounty(text: string): string {
  const lower = text.toLowerCase();
  for (const county of KENYA_COUNTIES) {
    if (lower.includes(county.toLowerCase())) return county;
  }
  return "";
}

export function parseHeirList(text: string): string[] {
  const cleaned = text
    .replace(/\b(watoto|children|heirs|warithi|wanaangu|my kids)\b/gi, " ")
    .replace(/\b(ni|are|is|naitwa|called)\b/gi, " ");
  return cleaned
    .split(/\s*(?:,|;|&|\band\b|\bna\b|\bpia\b)\s+/i)
    .map(cleanName)
    .filter((name) => looksLikeName(name) && name.split(" ").length <= 6)
    .slice(0, 12);
}

export function parseOcrText(text: string): Partial<IntakeDraft> {
  const out: Partial<IntakeDraft> = {};
  const kra = text.match(KRA_RE);
  if (kra) out.kraPin = kra[1].toUpperCase();
  const id = text.match(ID_RE);
  if (id) out.nationalId = id[1];
  const lr = text.match(LR_RE) || text.match(LR_NAKED_RE);
  if (lr) {
    const value = (lr[1] || lr[0]).replace(/^LR[\s./-]*/i, "");
    out.lrNumber = `LR ${value}`.replace(/\s+/g, " ").trim();
  }
  const nameLine =
    text.match(
      /(?:full\s*names?|jina\s*kamili|names?)\s*[:.]?\s*([A-Z][A-Z' ]{5,60})/i,
    ) || text.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,4})\b/);
  if (nameLine && looksLikeName(nameLine[1])) {
    out.fullName = cleanName(nameLine[1]);
  }
  const county = extractCounty(text);
  if (county) {
    out.county = county;
    out.shambaLocation = out.shambaLocation || county;
  }
  return out;
}

export function parseUtterance(
  text: string,
  current: IntakeDraft,
): Partial<IntakeDraft> {
  const out: Partial<IntakeDraft> = {};
  const trimmed = text.trim();
  if (!trimmed) return out;

  const kra = trimmed.match(KRA_RE);
  if (kra) out.kraPin = kra[1].toUpperCase();
  const id = trimmed.match(ID_RE);
  if (id && !/[A-Z]\d{9}[A-Z]/i.test(trimmed)) out.nationalId = id[1];
  const lr = trimmed.match(LR_RE) || trimmed.match(LR_NAKED_RE);
  if (lr) {
    const value = (lr[1] || "").replace(/^LR[\s./-]*/i, "");
    if (value) out.lrNumber = `LR ${value}`.replace(/\s+/g, " ").trim();
  }
  const mpesa = trimmed.match(MPESA_RE);
  if (mpesa) out.mpesaNumber = mpesa[1];
  const county = extractCounty(trimmed);
  if (county) {
    out.county = county;
    if (!current.shambaLocation) out.shambaLocation = trimmed;
  }

  const nameIntro = trimmed.match(
    /(?:jina langu ni|my name is|nina itwa|naitwa|i am)\s+(.+)/i,
  );
  if (nameIntro && looksLikeName(nameIntro[1])) {
    out.fullName = cleanName(nameIntro[1]);
  }

  const spouseIntro = trimmed.match(
    /(?:mke wangu ni|mume wangu ni|my (?:wife|husband|spouse) is)\s+(.+)/i,
  );
  if (spouseIntro && looksLikeName(spouseIntro[1])) {
    out.spouseName = cleanName(spouseIntro[1]);
  }

  const saccoIntro = trimmed.match(
    /(?:sacco(?:\s*(?:yangu|langu|ni))?|i save (?:at|with))\s+(.+)/i,
  );
  if (saccoIntro) {
    const name = cleanName(saccoIntro[1]);
    if (name.length >= 2) out.saccoName = name;
  }

  const bankIntro = trimmed.match(
    /(?:benki(?:\s*(?:yangu|ni))?|bank(?:\s*(?:is|account))?)\s+(.+)/i,
  );
  if (bankIntro) {
    const name = cleanName(bankIntro[1].replace(/\baccount\b/i, ""));
    if (name.length >= 2) out.bankName = name;
  }

  return out;
}

export function mergeIntakeDraft(
  base: IntakeDraft,
  patch: Partial<IntakeDraft> | null | undefined,
): IntakeDraft {
  const next: IntakeDraft = { ...base, heirs: [...base.heirs] };
  if (!patch) return next;
  const keys: Array<keyof IntakeDraft> = [
    "fullName",
    "nationalId",
    "kraPin",
    "spouseName",
    "trusteeName",
    "shambaLocation",
    "lrNumber",
    "plotSize",
    "county",
    "saccoName",
    "saccoMemberNumber",
    "bankName",
    "accountNumber",
    "mpesaNominee",
    "mpesaNumber",
    "documentName",
    "documentPath",
  ];
  for (const key of keys) {
    const value = patch[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (looksLikeSkip(trimmed)) continue;
    const current = next[key];
    if (typeof current === "string" && current.trim()) continue;
    (next[key] as string) = trimmed;
  }
  if (Array.isArray(patch.heirs)) {
    const seen = new Set(next.heirs.map((h) => h.toLowerCase()));
    for (const heir of patch.heirs) {
      const name = cleanName(heir);
      if (!looksLikeName(name)) continue;
      if (seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      next.heirs.push(name);
    }
  }
  if (Array.isArray(patch.skippedFields)) {
    for (const field of patch.skippedFields) {
      if (!next.skippedFields.includes(field)) next.skippedFields.push(field);
    }
  }
  return next;
}

export function applySkipIfNeeded(
  draft: IntakeDraft,
  utterance: string,
  field: string,
): IntakeDraft {
  if (!looksLikeSkip(utterance)) return draft;
  if (isSkipped(draft, field)) return draft;
  return markSkipped(draft, field);
}

export function sanitizeDraft(input: unknown): IntakeDraft {
  const base = emptyIntakeDraft();
  if (!input || typeof input !== "object") return base;
  const raw = input as Record<string, unknown>;
  return mergeIntakeDraft(base, {
    fullName: typeof raw.fullName === "string" ? raw.fullName : "",
    nationalId: typeof raw.nationalId === "string" ? raw.nationalId : "",
    kraPin: typeof raw.kraPin === "string" ? raw.kraPin : "",
    spouseName: typeof raw.spouseName === "string" ? raw.spouseName : "",
    heirs: Array.isArray(raw.heirs)
      ? raw.heirs.filter((h): h is string => typeof h === "string")
      : [],
    trusteeName: typeof raw.trusteeName === "string" ? raw.trusteeName : "",
    shambaLocation:
      typeof raw.shambaLocation === "string" ? raw.shambaLocation : "",
    lrNumber: typeof raw.lrNumber === "string" ? raw.lrNumber : "",
    plotSize: typeof raw.plotSize === "string" ? raw.plotSize : "",
    county: typeof raw.county === "string" ? raw.county : "",
    saccoName: typeof raw.saccoName === "string" ? raw.saccoName : "",
    saccoMemberNumber:
      typeof raw.saccoMemberNumber === "string" ? raw.saccoMemberNumber : "",
    bankName: typeof raw.bankName === "string" ? raw.bankName : "",
    accountNumber:
      typeof raw.accountNumber === "string" ? raw.accountNumber : "",
    mpesaNominee: typeof raw.mpesaNominee === "string" ? raw.mpesaNominee : "",
    mpesaNumber: typeof raw.mpesaNumber === "string" ? raw.mpesaNumber : "",
    documentName: typeof raw.documentName === "string" ? raw.documentName : "",
    documentPath: typeof raw.documentPath === "string" ? raw.documentPath : "",
    skippedFields: Array.isArray(raw.skippedFields)
      ? raw.skippedFields.filter((f): f is string => typeof f === "string")
      : [],
  });
}
