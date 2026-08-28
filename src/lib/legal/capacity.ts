export function isSeventyFiveOrOlder(birthYear: number | null | undefined): boolean {
  if (!birthYear || birthYear < 1900) return false;
  const age = new Date().getFullYear() - birthYear;
  return age >= 75;
}

export function parseBirthYear(raw: string | number | null | undefined): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw || "").trim());
  if (!Number.isInteger(n) || n < 1900 || n > new Date().getFullYear()) return null;
  return n;
}
