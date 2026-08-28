import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  addAudit,
  findUserById,
  getAsset,
  listAssets,
  saveTitleLookup,
} from "@/lib/db/store";

const schema = z.object({
  titleNumber: z.string().optional().default(""),
  county: z.string().optional().default(""),
  assetId: z.string().optional().nullable(),
  parcelNumber: z.string().optional().default(""),
  blockNumber: z.string().optional().default(""),
  registrationSection: z.string().optional().default(""),
  landRegistryOffice: z.string().optional().default(""),
});

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter the parcel identifiers from your title deed." },
      { status: 400 },
    );
  }
  let titleNumber = parsed.data.titleNumber.trim();
  let county = parsed.data.county.trim();
  let assetId = parsed.data.assetId || null;
  let parcelNumber = parsed.data.parcelNumber.trim();
  let blockNumber = parsed.data.blockNumber.trim();
  let registrationSection = parsed.data.registrationSection.trim();
  let landRegistryOffice = parsed.data.landRegistryOffice.trim();
  if (assetId) {
    const asset = await getAsset(access.vault.id, assetId);
    if (asset) {
      titleNumber = asset.titleNumber || titleNumber;
      county = asset.county || county;
      parcelNumber = asset.parcelNumber || parcelNumber;
      blockNumber = asset.blockNumber || blockNumber;
      registrationSection = asset.registrationSection || registrationSection;
      landRegistryOffice = asset.landRegistryOffice || landRegistryOffice;
      assetId = asset.id;
    }
  }
  if (!titleNumber && !parcelNumber) {
    return NextResponse.json(
      { error: "Enter a title / LR number or parcel number so the advocate can file." },
      { status: 400 },
    );
  }
  const owner = await findUserById(access.vault.ownerId);
  const lookup = await saveTitleLookup({
    vaultId: access.vault.id,
    assetId,
    titleNumber,
    county,
    requestedByUserId: access.session.userId,
    ardhiSasaId: owner?.ardhiSasaId,
    ecitizenId: owner?.ecitizenId,
    parcelNumber,
    blockNumber,
    registrationSection,
    landRegistryOffice,
  });
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "ardhisasa_filing_requested",
    detail: `${titleNumber || parcelNumber}: pending advocate submission`,
  });
  return NextResponse.json({ lookup }, { status: 201 });
}

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const assets = await listAssets(access.vault.id);
  return NextResponse.json({ assets });
}
