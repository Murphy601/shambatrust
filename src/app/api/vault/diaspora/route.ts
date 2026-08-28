import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  addAudit,
  findUserById,
  listActiveAdvocates,
  listAssets,
  listConsultBookingsForVault,
  listPaymentCheckouts,
  listTitleLookups,
  listBeneficiaries,
  updateUserDiasporaProfile,
} from "@/lib/db/store";

const schema = z.object({
  diasporaNationalId: z.string().max(80).optional().default(""),
  ecitizenId: z.string().max(80).optional().default(""),
  ardhiSasaId: z.string().max(80).optional().default(""),
  passportNumber: z.string().max(80).optional().default(""),
  passportCountry: z.string().max(80).optional().default(""),
  countryOfResidence: z.string().max(80).optional().default(""),
  isDiaspora: z.boolean().optional(),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const owner = await findUserById(access.vault.ownerId);
  const [advocates, bookings, checkouts, lookups, assets, heirs] = await Promise.all([
    listActiveAdvocates(),
    listConsultBookingsForVault(access.vault.id),
    listPaymentCheckouts(access.vault.id),
    listTitleLookups(access.vault.id),
    listAssets(access.vault.id),
    listBeneficiaries(access.vault.id),
  ]);
  return NextResponse.json({
    asAgent: access.asAgent,
    owner: owner
      ? {
          fullName: owner.fullName,
          phone: owner.phone,
          diasporaNationalId: owner.diasporaNationalId,
          ecitizenId: owner.ecitizenId,
          ardhiSasaId: owner.ardhiSasaId,
          passportNumber: owner.passportNumber,
          passportCountry: owner.passportCountry,
          countryOfResidence: owner.countryOfResidence,
          isDiaspora: owner.isDiaspora,
        }
      : null,
    advocates: advocates.map((a) => ({
      id: a.id,
      fullName: a.fullName,
      county: a.county,
      advocateLicense: a.advocateLicense,
    })),
    bookings,
    checkouts,
    lookups,
    assets,
    heirs: heirs.map((h) => ({
      id: h.id,
      fullName: h.fullName,
      phone: h.phone,
      relationship: h.relationship,
    })),
  });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.asAgent) {
    return NextResponse.json(
      { error: "Only the vault owner can save diaspora identity details." },
      { status: 403 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check diaspora identity fields." }, { status: 400 });
  }
  const owner = await updateUserDiasporaProfile(access.session.userId, parsed.data);
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "diaspora_profile_saved",
    detail: parsed.data.countryOfResidence || "Diaspora KYC updated",
  });
  return NextResponse.json({ owner });
}
