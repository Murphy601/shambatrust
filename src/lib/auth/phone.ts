/** Normalize Kenyan phone numbers to 2547XXXXXXXX */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("7")) return `254${digits}`;
  return null;
}

/** Compare phones after normalization (handles 07… vs 2547…). */
export function phonesEqual(a: string, b: string): boolean {
  const na = normalizeKenyanPhone(a);
  const nb = normalizeKenyanPhone(b);
  if (na && nb) return na === nb;
  return a.replace(/\D/g, "") === b.replace(/\D/g, "");
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizeKenyanPhone(phone) || phone;
  if (normalized.length === 12 && normalized.startsWith("254")) {
    return `+${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6, 9)} ${normalized.slice(9)}`;
  }
  return phone.startsWith("+") ? phone : `+${normalized}`;
}
