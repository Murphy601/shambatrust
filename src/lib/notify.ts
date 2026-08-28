import {
  findUserById,
  getVaultById,
  listBeneficiaries,
  queueOutboundNotice,
} from "@/lib/db/store";
import { familyAssistMessage } from "@/lib/land-registry/verification";
import { buildPeerWhatsAppUrl, buildWhatsAppUrl } from "@/lib/whatsapp";

async function trySms(toPhone: string, body: string): Promise<string | null> {
  const apiKey = process.env.AFRICAS_TALKING_API_KEY;
  const username = process.env.AFRICAS_TALKING_USERNAME;
  if (!apiKey || !username) return "queued_no_gateway";
  try {
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        username,
        to: toPhone.startsWith("+") ? toPhone : `+${toPhone}`,
        message: body,
      }),
    });
    if (!res.ok) return `sms_http_${res.status}`;
    return null;
  } catch {
    return "sms_network";
  }
}

export async function notifyVaultStatus(input: {
  vaultId: string;
  action: string;
  body: string;
}): Promise<void> {
  try {
    const vault = await getVaultById(input.vaultId);
    if (!vault) return;
    const owner = await findUserById(vault.ownerId);
    const heirs = await listBeneficiaries(vault.id);
    const phones = [owner?.phone, heirs[0]?.phone].filter(
      (phone): phone is string => Boolean(phone),
    );
    const unique = [...new Set(phones)];
    for (const phone of unique) {
      const smsError = await trySms(phone, input.body);
      await queueOutboundNotice({
        vaultId: vault.id,
        channel: "sms",
        toPhone: phone,
        body: input.body,
        relatedAction: input.action,
        status: smsError ? "queued" : "sent",
        error: smsError,
      });
      await queueOutboundNotice({
        vaultId: vault.id,
        channel: "whatsapp",
        toPhone: phone,
        body: input.body,
        relatedAction: input.action,
        status: "queued",
        error: null,
      });
    }
  } catch {
    // Never fail a vault save because a notice could not send.
  }
}

export function noticeWhatsAppUrl(body: string): string {
  return buildWhatsAppUrl(body);
}

export async function notifyFamilyArdhiSasaAssist(input: {
  vaultId: string;
  toPhone: string;
  elderName: string;
  locale?: "en" | "sw";
}): Promise<{ body: string; whatsappUrl: string; smsQueued: boolean }> {
  const body = familyAssistMessage(input.elderName, input.locale || "en");
  const smsError = await trySms(input.toPhone, body);
  await queueOutboundNotice({
    vaultId: input.vaultId,
    channel: "sms",
    toPhone: input.toPhone,
    body,
    relatedAction: "ardhisasa_family_assist",
    status: smsError ? "queued" : "sent",
    error: smsError,
  });
  await queueOutboundNotice({
    vaultId: input.vaultId,
    channel: "whatsapp",
    toPhone: input.toPhone,
    body,
    relatedAction: "ardhisasa_family_assist",
    status: "queued",
    error: null,
  });
  return {
    body,
    whatsappUrl: buildPeerWhatsAppUrl(input.toPhone, body),
    smsQueued: Boolean(smsError),
  };
}
