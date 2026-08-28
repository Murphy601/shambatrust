import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  addAudit,
  deleteHouseholdHouse,
  listAssets,
  listBeneficiaries,
  listHouseholdHouses,
  saveHouseholdHouse,
} from "@/lib/db/store";

const schema = z.object({
  id: z.string().optional(),
  houseLabel: z.string().min(2).max(120),
  wifeName: z.string().max(120).optional().default(""),
  notes: z.string().max(2000).optional().default(""),
  allocatedAssetIds: z.array(z.string()).optional().default([]),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const [houses, heirs, assets] = await Promise.all([
    listHouseholdHouses(access.vault.id),
    listBeneficiaries(access.vault.id),
    listAssets(access.vault.id),
  ]);
  return NextResponse.json({ houses, heirs, assets, asAgent: access.asAgent });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.asAgent) {
    return NextResponse.json(
      { error: "Only the settlor can structure polygamous houses." },
      { status: 403 },
    );
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Name this house (e.g. First house)." }, { status: 400 });
  }
  const house = await saveHouseholdHouse({
    ...parsed.data,
    vaultId: access.vault.id,
  });
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: parsed.data.id ? "house_updated" : "house_added",
    detail: house.houseLabel,
  });
  return NextResponse.json({ house }, { status: parsed.data.id ? 200 : 201 });
}

export async function DELETE(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.asAgent) {
    return NextResponse.json(
      { error: "Only the settlor can remove a house." },
      { status: 403 },
    );
  }
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "House id required." }, { status: 400 });
  }
  const ok = await deleteHouseholdHouse(access.vault.id, body.id);
  if (!ok) return NextResponse.json({ error: "House not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
