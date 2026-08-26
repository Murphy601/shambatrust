import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  addAudit,
  findUserById,
  getLegalDocument,
  getReviewRequest,
  stampLegalDocument,
} from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  documentId: z.string().min(1),
  county: z.string().max(80).optional().default(""),
  notes: z.string().max(1000).optional().default(""),
});

/**
 * Applies the advocate's legal stamp to a draft instrument. The stamp records
 * who verified the document and under which practising certificate, and is a
 * precondition for e-signing — you stamp what you have read, then you sign it.
 */
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
      { error: "Claim this case before stamping documents." },
      { status: 403 },
    );
  }
  if (review.status === "completed" || review.docAccessRevokedAt) {
    return NextResponse.json(
      { error: "Sealed cases are read-only." },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid stamp request." }, { status: 400 });
  }

  const document = await getLegalDocument(parsed.data.documentId);
  if (!document || document.reviewRequestId !== review.id) {
    return NextResponse.json(
      { error: "Document is not on this case." },
      { status: 404 },
    );
  }

  const advocate = await findUserById(access.session.userId);
  if (!advocate?.advocateLicense) {
    return NextResponse.json(
      {
        error:
          "Your LSK practising number is missing. Contact operations before stamping.",
      },
      { status: 400 },
    );
  }

  const stamped = await stampLegalDocument({
    documentId: document.id,
    advocateUserId: access.session.userId,
    advocateName: advocate.fullName,
    lskNumber: advocate.advocateLicense,
    county: parsed.data.county,
    notes: parsed.data.notes,
  });
  if (!stamped) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  await addAudit({
    vaultId: review.vaultId,
    actorUserId: access.session.userId,
    action: "document_stamped",
    detail: `${stamped.title} · stamp ${stamped.stampRef} · LSK ${stamped.stampLskNumber}`,
  });

  return NextResponse.json({ document: { ...stamped, documentPath: null } });
}
