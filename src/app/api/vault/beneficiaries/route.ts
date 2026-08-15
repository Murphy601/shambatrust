import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeKenyanPhone } from "@/lib/auth/phone";
import { requireVaultAccess } from "@/lib/vault-access";
import { vaultContentLocked } from "@/lib/vault-lock";
import {
  addAudit,
  listBeneficiaries,
  saveBeneficiary,
} from "@/lib/db/store";

const schema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2),
  idNumber: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  relationship: z.string().min(1),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const beneficiaries = await listBeneficiaries(access.vault.id);
  return NextResponse.json({
    beneficiaries,
    asAgent: access.asAgent,
    locked: vaultContentLocked(access.vault),
    amendmentOpen: access.vault.amendmentOpen,
  });
}

async function upsertBeneficiary(body: unknown) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (vaultContentLocked(access.vault)) {
    return NextResponse.json(
      {
        error:
          "This vault is in legal review. Asset and heir edits are locked until review completes.",
      },
      { status: 403 },
    );
  }

  if (access.asAgent) {
    return NextResponse.json(
      {
        error:
          "Adding or changing heirs requires elder OTP confirmation (Agent Mode).",
        requiresElder: true,
      },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check heir details." }, { status: 400 });
  }

  const phoneRaw = parsed.data.phone.trim();
  if (phoneRaw && !normalizeKenyanPhone(phoneRaw)) {
    return NextResponse.json(
      {
        error:
          "Enter a valid Kenyan phone (e.g. 0712 345 678 or 254712345678).",
      },
      { status: 400 },
    );
  }

  const existing = await listBeneficiaries(access.vault.id);
  const idTrim = parsed.data.idNumber.trim();
  const duplicateId =
    idTrim.length > 0 &&
    existing.some(
      (b) =>
        b.idNumber.trim() === idTrim &&
        (!parsed.data.id || b.id !== parsed.data.id),
    );

  const beneficiary = await saveBeneficiary({
    ...parsed.data,
    vaultId: access.vault.id,
  });

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: parsed.data.id ? "beneficiary_updated" : "beneficiary_added",
    detail: beneficiary.fullName,
  });

  return NextResponse.json({
    beneficiary,
    warning: duplicateId
      ? "Another heir already uses this ID number. Confirm this is intentional."
      : null,
  });
}

export async function POST(request: Request) {
  return upsertBeneficiary(await request.json());
}

export async function PATCH(request: Request) {
  const body = await request.json();
  if (!body?.id) {
    return NextResponse.json(
      { error: "Heir id is required to edit." },
      { status: 400 },
    );
  }
  return upsertBeneficiary(body);
}
