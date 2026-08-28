import type { Beneficiary } from "@/lib/db/types";

const AUTO_START = "=== BEGIN AUTO TESTAMENTARY TRUST ===";
const AUTO_END = "=== END AUTO TESTAMENTARY TRUST ===";

export function ageFromDob(dob: string, now = new Date()): number | null {
  const trimmed = dob.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const month = now.getMonth() - d.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export function isMinorDob(dob: string, now = new Date()): boolean {
  const age = ageFromDob(dob, now);
  return age !== null && age < 18;
}

export function defaultTestamentaryTrustBlock(minors: Beneficiary[]): string {
  const names = minors
    .map((m) => {
      const age = ageFromDob(m.dateOfBirth);
      return age != null ? `${m.fullName} (age ${age})` : m.fullName;
    })
    .join("; ");
  return [
    AUTO_START,
    `TESTAMENTARY TRUST — protection of minor children (Law of Succession Act).`,
    `The following beneficiaries are under 18 years of age: ${names || "(none named)"}.`,
    `Their shares of the estate — including school fees, upkeep, medical care, and maintenance — shall be held by the executor/trustee in a testamentary trust until each child attains 18 years of age.`,
    `Income may be applied for education and welfare. Capital shall not be released to a minor except as the advocate-drafted instrument permits.`,
    `This clause is recorded automatically whenever a minor heir is named. A partner advocate must still draft and seal the will.`,
    AUTO_END,
  ].join("\n");
}

export function mergeTestamentaryTrustTerms(
  existing: string,
  minors: Beneficiary[],
): string {
  const block = defaultTestamentaryTrustBlock(minors);
  const current = existing || "";
  const start = current.indexOf(AUTO_START);
  const end = current.indexOf(AUTO_END);
  if (start >= 0 && end > start) {
    return (
      current.slice(0, start).trimEnd() +
      (start > 0 ? "\n\n" : "") +
      block +
      current.slice(end + AUTO_END.length)
    ).trim();
  }
  if (!current.trim()) return block;
  return `${current.trim()}\n\n${block}`;
}
