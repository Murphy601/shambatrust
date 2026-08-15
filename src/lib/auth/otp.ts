import { createHash, randomInt } from "crypto";
import { clearOtp, getOtp, upsertOtp } from "@/lib/db/store";

const OTP_TTL_MS = 10 * 60 * 1000;

type OtpPurpose = "login" | "elder_confirm" | "succession_confirm";

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function issueOtp(
  phone: string,
  purpose: OtpPurpose,
  meta?: Record<string, unknown>,
): Promise<{ code: string; expiresAt: string }> {
  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  await upsertOtp({
    phone,
    codeHash: hashCode(code),
    expiresAt,
    attempts: 0,
    purpose,
    meta,
  });
  return { code, expiresAt };
}

export async function verifyOtp(
  phone: string,
  code: string,
  purpose: OtpPurpose,
): Promise<{ ok: true; meta?: Record<string, unknown> } | { ok: false; error: string }> {
  const record = await getOtp(phone, purpose);
  if (!record) return { ok: false, error: "No code found. Request a new one." };
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await clearOtp(phone, purpose);
    return { ok: false, error: "Code expired. Request a new one." };
  }
  if (record.attempts >= 5) {
    await clearOtp(phone, purpose);
    return { ok: false, error: "Too many attempts. Request a new code." };
  }
  if (record.codeHash !== hashCode(code.trim())) {
    record.attempts += 1;
    await upsertOtp(record);
    return { ok: false, error: "Incorrect code. Try again." };
  }
  await clearOtp(phone, purpose);
  return { ok: true, meta: record.meta };
}

export function isDevAuthMode(): boolean {
  return process.env.AUTH_DEV_MODE !== "false";
}
