import { buildWhatsAppUrl } from "@/lib/whatsapp";
import type { AdvocateApplicationStatus } from "@/lib/db/types";

export function advocatePortalLoginUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/advocate/login`;
}

export function buildAdvocateDecisionMessage(input: {
  fullName: string;
  status: AdvocateApplicationStatus;
  adminNotes: string;
  portalUrl: string;
}): string {
  const notes = input.adminNotes.trim();
  if (input.status === "approved") {
    return (
      `Habari ${input.fullName}, your ShambaTrust partner advocate application has been APPROVED.\n\n` +
      `Sign in here (phone OTP + your LSK practising number):\n${input.portalUrl}\n\n` +
      (notes ? `Note from admin: ${notes}\n\n` : "") +
      `Karibu to the ShambaTrust advocate team.`
    );
  }
  if (input.status === "rejected") {
    return (
      `Habari ${input.fullName}, thank you for applying to join ShambaTrust advocates.\n\n` +
      `Status: REJECTED.\n` +
      (notes ? `Reason: ${notes}\n\n` : "\n") +
      `You may re-apply later with updated documents if appropriate.`
    );
  }
  // needs_info
  return (
    `Habari ${input.fullName}, we reviewed your ShambaTrust advocate application.\n\n` +
    `Status: WE NEED MORE INFORMATION.\n` +
    (notes ? `Please provide: ${notes}\n\n` : "\n") +
    `Reply on this WhatsApp or update your application materials as requested.\n` +
    `Portal (after approval): ${input.portalUrl}`
  );
}

export function buildAdvocateDecisionWhatsAppUrl(input: {
  phone: string;
  fullName: string;
  status: AdvocateApplicationStatus;
  adminNotes: string;
  portalUrl: string;
}): string {
  const message = buildAdvocateDecisionMessage(input);
  // Prefer messaging the applicant's number when possible
  const digits = input.phone.replace(/\D/g, "");
  if (digits.length >= 9) {
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }
  return buildWhatsAppUrl(message);
}
