const DEFAULT_NUMBER = "254748879579";

export function getWhatsAppNumber(): string {
  return (
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") || DEFAULT_NUMBER
  );
}

export function buildWhatsAppUrl(message: string): string {
  const number = getWhatsAppNumber();
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

/** Direct chat with a family helper (not the ShambaTrust hotline). */
export function buildPeerWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const intl = digits.startsWith("254")
    ? digits
    : digits.startsWith("0") && digits.length === 10
      ? `254${digits.slice(1)}`
      : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}
