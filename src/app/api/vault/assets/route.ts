import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import { vaultContentLocked } from "@/lib/vault-lock";
import { addAudit, listAssets, saveAsset } from "@/lib/db/store";
import { isLandLike, nomineeTotal } from "@/lib/asset-fields";

const nomineeSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2),
  idNumber: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  relationship: z.string().optional().default(""),
  percentage: z.number().min(0).max(100),
});

const assetSchema = z.object({
  id: z.string().optional(),
  type: z.enum([
    "land",
    "commercial_plot",
    "business",
    "vehicle",
    "bank_account",
    "sacco",
    "other",
  ]),
  title: z.string().min(1),
  notes: z.string().optional().default(""),
  documentName: z.string().nullable().optional(),
  documentPath: z.string().nullable().optional(),
  titleNumber: z.string().optional().default(""),
  county: z.string().optional().default(""),
  subCounty: z.string().optional().default(""),
  landmark: z.string().optional().default(""),
  gpsLat: z.number().nullable().optional(),
  gpsLng: z.number().nullable().optional(),
  parcelNumber: z.string().optional().default(""),
  blockNumber: z.string().optional().default(""),
  registrationSection: z.string().optional().default(""),
  landRegistryOffice: z.string().optional().default(""),
  registrationNumber: z.string().optional().default(""),
  makeModel: z.string().optional().default(""),
  year: z.string().optional().default(""),
  bankName: z.string().optional().default(""),
  accountNumber: z.string().optional().default(""),
  accountType: z.string().optional().default(""),
  businessRegNumber: z.string().optional().default(""),
  kraPin: z.string().optional().default(""),
  saccoName: z.string().optional().default(""),
  saccoMemberNumber: z.string().optional().default(""),
  saccoNominees: z.array(nomineeSchema).max(10).optional().default([]),
  mpesaNumber: z.string().optional().default(""),
});

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const assets = await listAssets(access.vault.id);
  return NextResponse.json({
    assets,
    asAgent: access.asAgent,
    locked: vaultContentLocked(access.vault),
    amendmentOpen: access.vault.amendmentOpen,
  });
}

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  if (vaultContentLocked(access.vault)) {
    return NextResponse.json(
      {
        error:
          "This vault is in legal review. Asset edits are locked until review completes.",
      },
      { status: 403 },
    );
  }

  const json = await request.json();
  const parsed = assetSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the asset details." }, { status: 400 });
  }

  const data = parsed.data;

  if (isLandLike(data.type) && !data.county.trim()) {
    return NextResponse.json(
      { error: "County is required for land / plots." },
      { status: 400 },
    );
  }
  if (data.type === "vehicle" && !data.registrationNumber.trim()) {
    return NextResponse.json(
      { error: "Vehicle registration number is required." },
      { status: 400 },
    );
  }
  if (
    data.type === "bank_account" &&
    (!data.bankName.trim() || !data.accountNumber.trim())
  ) {
    return NextResponse.json(
      { error: "Bank name and account number are required." },
      { status: 400 },
    );
  }
  if (
    data.type === "business" &&
    !data.businessRegNumber.trim() &&
    !data.kraPin.trim()
  ) {
    return NextResponse.json(
      { error: "Add a business registration number or KRA PIN." },
      { status: 400 },
    );
  }
  if (data.type === "sacco" && !data.saccoName.trim()) {
    return NextResponse.json(
      { error: "SACCO name is required." },
      { status: 400 },
    );
  }

  // Nominee shares are what the SACCO pays out on, so a partial split would
  // silently leave a remainder in dispute.
  const nominees = data.type === "sacco" ? data.saccoNominees : [];
  if (nominees.length > 0) {
    const total = nomineeTotal(
      nominees.map((nominee) => ({ ...nominee, id: nominee.id ?? "" })),
    );
    if (Math.round(total) !== 100) {
      return NextResponse.json(
        {
          error: `SACCO nominee percentages must add up to 100% (currently ${total}%).`,
        },
        { status: 400 },
      );
    }
  }

  const asset = await saveAsset({
    ...data,
    saccoNominees: nominees,
    vaultId: access.vault.id,
    documentName: data.documentName ?? null,
    documentPath: data.documentPath ?? null,
    gpsLat: data.gpsLat ?? null,
    gpsLng: data.gpsLng ?? null,
  });

  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: data.id ? "asset_updated" : "asset_created",
    detail: `${asset.title} (${asset.type})`,
  });

  return NextResponse.json({ asset });
}
