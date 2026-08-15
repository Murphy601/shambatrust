import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/secure-docs/access";
import {
  findUserById,
  getSupportSession,
  getVaultById,
  listAssets,
  listBeneficiaries,
} from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const access = await requireAdminAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const { id } = await params;
  const session = await getSupportSession(id);
  if (!session) {
    return NextResponse.json({ error: "Support session not found." }, { status: 404 });
  }
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ error: "Support session expired." }, { status: 410 });
  }
  const vault = await getVaultById(session.vaultId);
  if (!vault) {
    return NextResponse.json({ error: "Vault missing." }, { status: 404 });
  }
  const [owner, assets, beneficiaries] = await Promise.all([
    findUserById(vault.ownerId),
    listAssets(vault.id),
    listBeneficiaries(vault.id),
  ]);
  return NextResponse.json({
    session,
    vault: {
      id: vault.id,
      status: vault.status,
      packageTier: vault.packageTier,
      opsNotes: vault.opsNotes,
    },
    owner: owner
      ? { fullName: owner.fullName, phone: owner.phone }
      : null,
    assets: assets.map((a) => ({ title: a.title, type: a.type })),
    beneficiaries: beneficiaries.map((b) => ({
      fullName: b.fullName,
      relationship: b.relationship,
    })),
    readOnly: true,
  });
}
