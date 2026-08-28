import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { lookupTitleDeed } from "@/lib/land-registry/mock";
import {
  addAudit,
  findUserById,
  getAsset,
  saveTitleLookup,
} from "@/lib/db/store";

const schema = z.object({
  titleNumber: z.string().min(1),
  county: z.string().optional().default(""),
  assetId: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a title / LR number." }, { status: 400 });
  }
  let titleNumber = parsed.data.titleNumber;
  let county = parsed.data.county;
  let assetId = parsed.data.assetId || null;
  if (assetId) {
    const asset = await getAsset(access.vault.id, assetId);
    if (asset) {
      titleNumber = asset.titleNumber || titleNumber;
      county = asset.county || county;
      assetId = asset.id;
    }
  }
  const owner = await findUserById(access.vault.ownerId);
  const result = lookupTitleDeed({ titleNumber, county });
  const lookup = await saveTitleLookup({
    vaultId: access.vault.id,
    assetId,
    titleNumber,
    county,
    result,
    requestedByUserId: access.session.userId,
    ardhiSasaId: owner?.ardhiSasaId,
    ecitizenId: owner?.ecitizenId,
  });
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "diaspora_title_lookup",
    detail: `${titleNumber}: ${result.registrationStatus}`,
  });
  return NextResponse.json({ lookup }, { status: 201 });
}
