import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { addAudit, saveVaultLocator } from "@/lib/db/store";

const schema = z.object({
  physicalDocumentLocation: z.string().optional(),
  emergencyMedicalNotes: z.string().optional(),
  emergencyPrimaryContactName: z.string().optional(),
  emergencyPrimaryContactPhone: z.string().optional(),
  rotateEmergencyCard: z.boolean().optional(),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const vault = access.vault;
  return NextResponse.json({
    physicalDocumentLocation: vault.physicalDocumentLocation,
    physicalDocumentUpdatedAt: vault.physicalDocumentUpdatedAt,
    emergencyCardToken: vault.emergencyCardToken,
    emergencyCardCreatedAt: vault.emergencyCardCreatedAt,
    emergencyMedicalNotes: vault.emergencyMedicalNotes,
    emergencyPrimaryContactName: vault.emergencyPrimaryContactName,
    emergencyPrimaryContactPhone: vault.emergencyPrimaryContactPhone,
  });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the locator details." }, { status: 400 });
  }
  const saved = await saveVaultLocator(access.vault.id, parsed.data);
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: parsed.data.rotateEmergencyCard
      ? "emergency_card_issued"
      : "physical_document_location_saved",
    detail: parsed.data.rotateEmergencyCard
      ? "Emergency QR pocket card issued"
      : saved.physicalDocumentLocation || "Physical document location updated",
  });
  return NextResponse.json(saved);
}
