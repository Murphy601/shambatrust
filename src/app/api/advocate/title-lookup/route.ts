import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  addAudit,
  findUserById,
  getAsset,
  getReviewRequest,
  getTitleLookup,
  getVaultById,
  saveTitleLookup,
  updateTitleLookup,
  writeStoredFile,
} from "@/lib/db/store";

const requestSchema = z.object({
  action: z.enum(["request", "mark_filed", "withdraw"]).optional().default("request"),
  reviewId: z.string().optional(),
  vaultId: z.string(),
  lookupId: z.string().optional(),
  assetId: z.string().nullable().optional(),
  titleNumber: z.string().optional().default(""),
  county: z.string().optional().default(""),
  parcelNumber: z.string().optional().default(""),
  blockNumber: z.string().optional().default(""),
  registrationSection: z.string().optional().default(""),
  landRegistryOffice: z.string().optional().default(""),
  advocateNotes: z.string().max(2000).optional().default(""),
});

async function assertAssignedCase(
  reviewId: string | undefined,
  vaultId: string,
  advocateId: string,
) {
  if (!reviewId) {
    return { ok: false as const, error: "Claim this case first.", status: 400 };
  }
  const review = await getReviewRequest(reviewId);
  if (!review || review.vaultId !== vaultId) {
    return { ok: false as const, error: "Review/vault mismatch.", status: 400 };
  }
  if (review.advocateId !== advocateId || review.status !== "assigned") {
    return {
      ok: false as const,
      error: "Claim this active case before filing an ArdhiSasa search.",
      status: 403,
    };
  }
  return { ok: true as const, review };
}

export async function POST(request: Request) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const vaultId = String(form.get("vaultId") || "");
    const reviewId = String(form.get("reviewId") || "") || undefined;
    let lookupId = String(form.get("lookupId") || "") || undefined;
    const advocateNotes = String(form.get("advocateNotes") || "");
    if (!vaultId) {
      return NextResponse.json({ error: "Vault is required." }, { status: 400 });
    }
    const gate = await assertAssignedCase(reviewId, vaultId, access.session.userId);
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Upload the official ArdhiSasa search PDF." },
        { status: 400 },
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 8MB)." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `ardhisasa-${vaultId}-${randomUUID()}-${safeName}`;
    await writeStoredFile(filename, bytes, file.type || "application/pdf");

    if (!lookupId) {
      const created = await saveTitleLookup({
        vaultId,
        assetId: String(form.get("assetId") || "") || null,
        titleNumber: String(form.get("titleNumber") || ""),
        county: String(form.get("county") || ""),
        requestedByUserId: access.session.userId,
        reviewRequestId: reviewId || null,
      });
      lookupId = created.id;
    }
    const lookup = await updateTitleLookup({
      id: lookupId,
      documentName: file.name,
      documentPath: filename,
      advocateNotes,
      reviewRequestId: reviewId || null,
    });
    if (!lookup) {
      return NextResponse.json({ error: "Search request not found." }, { status: 404 });
    }
    await addAudit({
      vaultId,
      actorUserId: access.session.userId,
      action: "ardhisasa_certificate_uploaded",
      detail: lookup.titleNumber || lookup.documentName || lookup.id,
    });
    return NextResponse.json({ lookup });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ArdhiSasa filing request." }, { status: 400 });
  }

  const gate = await assertAssignedCase(
    parsed.data.reviewId,
    parsed.data.vaultId,
    access.session.userId,
  );
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  if (parsed.data.action === "mark_filed") {
    if (!parsed.data.lookupId) {
      return NextResponse.json(
        { error: "Select a filing to mark as submitted on ArdhiSasa." },
        { status: 400 },
      );
    }
    const existing = await getTitleLookup(parsed.data.lookupId);
    if (!existing || existing.vaultId !== parsed.data.vaultId) {
      return NextResponse.json({ error: "Search request not found." }, { status: 404 });
    }
    const lookup = await updateTitleLookup({
      id: existing.id,
      status: "awaiting_owner_consent",
      advocateNotes: parsed.data.advocateNotes,
      reviewRequestId: parsed.data.reviewId || existing.reviewRequestId,
    });
    await addAudit({
      vaultId: parsed.data.vaultId,
      actorUserId: access.session.userId,
      action: "ardhisasa_filed_awaiting_consent",
      detail: existing.titleNumber || existing.id,
    });
    return NextResponse.json({ lookup });
  }

  if (parsed.data.action === "withdraw") {
    if (!parsed.data.lookupId) {
      return NextResponse.json({ error: "Select a filing to withdraw." }, { status: 400 });
    }
    const lookup = await updateTitleLookup({
      id: parsed.data.lookupId,
      status: "withdrawn",
      advocateNotes: parsed.data.advocateNotes,
    });
    return NextResponse.json({ lookup });
  }

  let titleNumber = parsed.data.titleNumber.trim();
  let county = parsed.data.county.trim();
  let assetId = parsed.data.assetId || null;
  let parcelNumber = parsed.data.parcelNumber.trim();
  let blockNumber = parsed.data.blockNumber.trim();
  let registrationSection = parsed.data.registrationSection.trim();
  let landRegistryOffice = parsed.data.landRegistryOffice.trim();
  if (assetId) {
    const asset = await getAsset(parsed.data.vaultId, assetId);
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
      { error: "Select a land asset or enter a title / LR number." },
      { status: 400 },
    );
  }
  const vault = await getVaultById(parsed.data.vaultId);
  const vaultOwner = vault ? await findUserById(vault.ownerId) : null;

  const record = await saveTitleLookup({
    vaultId: parsed.data.vaultId,
    assetId,
    titleNumber,
    county,
    requestedByUserId: access.session.userId,
    reviewRequestId: parsed.data.reviewId || null,
    ardhiSasaId: vaultOwner?.ardhiSasaId,
    ecitizenId: vaultOwner?.ecitizenId,
    parcelNumber,
    blockNumber,
    registrationSection,
    landRegistryOffice,
    advocateNotes: parsed.data.advocateNotes,
  });

  await addAudit({
    vaultId: parsed.data.vaultId,
    actorUserId: access.session.userId,
    action: "ardhisasa_filing_opened",
    detail: `${titleNumber || parcelNumber}: pending advocate submission`,
  });

  return NextResponse.json({ lookup: record });
}
