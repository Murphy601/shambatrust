import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { checklistComplete } from "@/lib/advocate/checklist";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  addAudit,
  completeReviewRequest,
  getLegalDocument,
  getReviewRequest,
  listLegalDocumentsForReview,
  signLegalDocument,
  uploadsDir,
} from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

const jsonSchema = z.object({
  documentId: z.string(),
  signatureName: z.string().min(2),
  sealCase: z.boolean().optional().default(false),
  documentName: z.string().nullable().optional(),
  documentPath: z.string().nullable().optional(),
});

export async function POST(request: Request, { params }: Params) {
  const access = await requireAdvocateAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { id } = await params;
  const review = await getReviewRequest(id);
  if (!review) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  if (review.advocateId !== access.session.userId) {
    return NextResponse.json(
      { error: "Claim this case before signing." },
      { status: 403 },
    );
  }

  if (!checklistComplete(review.checklist)) {
    return NextResponse.json(
      { error: "Complete the verification checklist before e-signing." },
      { status: 400 },
    );
  }

  const contentType = request.headers.get("content-type") || "";

  let documentId: string;
  let signatureName: string;
  let sealCase = false;
  let documentName: string | null = null;
  let documentPath: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    documentId = String(form.get("documentId") || "");
    signatureName = String(form.get("signatureName") || "").trim();
    sealCase = String(form.get("sealCase") || "") === "true";

    const file = form.get("file");
    if (file instanceof File && file.size > 0) {
      if (file.size > 8 * 1024 * 1024) {
        return NextResponse.json(
          { error: "File too large (max 8MB)." },
          { status: 400 },
        );
      }
      const bytes = Buffer.from(await file.arrayBuffer());
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `certified-${review.vaultId}-${randomUUID()}-${safeName}`;
      const dir = uploadsDir();
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, filename), bytes);
      documentName = file.name;
      documentPath = filename;
    }
  } else {
    const parsed = jsonSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid sign request." }, { status: 400 });
    }
    documentId = parsed.data.documentId;
    signatureName = parsed.data.signatureName.trim();
    sealCase = parsed.data.sealCase;
    documentName = parsed.data.documentName ?? null;
    documentPath = parsed.data.documentPath ?? null;
  }

  if (!documentId || signatureName.length < 2) {
    return NextResponse.json(
      { error: "Document and typed signature name are required." },
      { status: 400 },
    );
  }

  const existing = await getLegalDocument(documentId);
  if (!existing || existing.reviewRequestId !== review.id) {
    return NextResponse.json({ error: "Document not on this case." }, { status: 404 });
  }

  const signed = await signLegalDocument({
    documentId,
    advocateUserId: access.session.userId,
    signatureName,
    documentName,
    documentPath,
  });

  await addAudit({
    vaultId: review.vaultId,
    actorUserId: access.session.userId,
    action: documentPath ? "document_certified" : "advocate_signed",
    detail: `${existing.type} signed by ${signatureName}`,
  });

  let completed = null;
  if (sealCase) {
    const docs = await listLegalDocumentsForReview(review.id);
    const hasSigned = docs.some(
      (d) =>
        d.id === documentId ||
        d.status === "signed" ||
        d.status === "certified",
    );
    if (!hasSigned && !signed) {
      return NextResponse.json(
        { error: "Sign at least one document before sealing." },
        { status: 400 },
      );
    }
    completed = await completeReviewRequest(review.id);
    await addAudit({
      vaultId: review.vaultId,
      actorUserId: access.session.userId,
      action: "vault_sealed",
      detail: "Advocate sealed the vault after e-sign",
    });
    await addAudit({
      vaultId: review.vaultId,
      actorUserId: access.session.userId,
      action: "doc_access_revoked",
      detail: "Advocate document access ended on seal",
    });

    // Auto-generate sealed vault binder PDF (versioned; ops downloads when ready)
    const { generateVaultBinderOnSeal } = await import("@/lib/binder/generate");
    await generateVaultBinderOnSeal({
      vaultId: review.vaultId,
      reviewRequestId: review.id,
      advocateUserId: access.session.userId,
      advocateName: access.session.fullName || signatureName,
    });
  }

  return NextResponse.json({ document: signed, review: completed });
}
