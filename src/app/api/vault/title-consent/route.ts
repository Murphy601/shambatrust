import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  addAudit,
  findUserById,
  getTitleLookup,
  listBeneficiaries,
  updateTitleLookup,
  writeStoredFile,
} from "@/lib/db/store";
import { notifyFamilyArdhiSasaAssist } from "@/lib/notify";

const jsonSchema = z.object({
  action: z.enum(["choose_path", "alert_family"]),
  lookupId: z.string().min(1),
  consentPath: z.enum(["paper_authorization", "family_assisted"]).optional(),
  beneficiaryId: z.string().optional(),
});

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const lookupId = String(form.get("lookupId") || "");
    const lookup = await getTitleLookup(lookupId);
    if (!lookup || lookup.vaultId !== access.vault.id) {
      return NextResponse.json({ error: "Search request not found." }, { status: 404 });
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Photograph or scan the signed one-page form." },
        { status: 400 },
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 8MB)." }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `title-consent-${access.vault.id}-${randomUUID()}-${safeName}`;
    await writeStoredFile(filename, bytes, file.type || "application/pdf");
    const updated = await updateTitleLookup({
      id: lookup.id,
      consentPath: "paper_authorization",
      authorizationName: file.name,
      authorizationPath: filename,
    });
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "ardhisasa_paper_consent_uploaded",
      detail: lookup.titleNumber || lookup.id,
    });
    return NextResponse.json({ lookup: updated });
  }

  const parsed = jsonSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose how the elder will consent." }, { status: 400 });
  }
  const lookup = await getTitleLookup(parsed.data.lookupId);
  if (!lookup || lookup.vaultId !== access.vault.id) {
    return NextResponse.json({ error: "Search request not found." }, { status: 404 });
  }

  if (parsed.data.action === "choose_path") {
    const path = parsed.data.consentPath || "paper_authorization";
    const updated = await updateTitleLookup({
      id: lookup.id,
      consentPath: path,
    });
    return NextResponse.json({ lookup: updated });
  }

  const heirs = await listBeneficiaries(access.vault.id);
  const helper =
    (parsed.data.beneficiaryId
      ? heirs.find((h) => h.id === parsed.data.beneficiaryId)
      : null) ||
    (lookup.consentHelperBeneficiaryId
      ? heirs.find((h) => h.id === lookup.consentHelperBeneficiaryId)
      : null) ||
    heirs.find((h) => h.phone.trim()) ||
    null;
  if (!helper?.phone) {
    return NextResponse.json(
      {
        error:
          "Name a child or heir with a phone number first, under Heirs. They will get the simple steps by SMS and WhatsApp.",
      },
      { status: 400 },
    );
  }
  const owner = await findUserById(access.vault.ownerId);
  const notice = await notifyFamilyArdhiSasaAssist({
    vaultId: access.vault.id,
    toPhone: helper.phone,
    elderName: owner?.fullName || "the elder",
    locale: owner?.locale || "en",
  });
  const updated = await updateTitleLookup({
    id: lookup.id,
    consentPath: "family_assisted",
    consentHelperBeneficiaryId: helper.id,
    consentHelperName: helper.fullName,
    consentHelperPhone: helper.phone,
    familyAlertSentAt: new Date().toISOString(),
  });
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "ardhisasa_family_assist_sent",
    detail: `${helper.fullName} · ${lookup.titleNumber || lookup.id}`,
  });
  return NextResponse.json({ lookup: updated, notice });
}