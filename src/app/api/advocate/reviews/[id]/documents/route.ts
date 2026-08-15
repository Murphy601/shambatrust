import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdvocateAccess } from "@/lib/advocate-access";
import {
  addAudit,
  getReviewRequest,
  saveLegalDocument,
} from "@/lib/db/store";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  type: z.enum(["will", "land_trust", "poa"]),
  title: z.string().min(2),
  body: z.string().default(""),
  status: z.enum(["draft", "ready_for_sign"]).optional(),
  documentId: z.string().optional(),
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

  if (review.status === "completed") {
    return NextResponse.json(
      { error: "Case already sealed." },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document." }, { status: 400 });
  }

  const doc = await saveLegalDocument({
    id: parsed.data.documentId,
    reviewRequestId: review.id,
    vaultId: review.vaultId,
    type: parsed.data.type,
    title: parsed.data.title,
    body: parsed.data.body,
    status: parsed.data.status || "draft",
    documentName: parsed.data.documentName,
    documentPath: parsed.data.documentPath,
  });

  await addAudit({
    vaultId: review.vaultId,
    actorUserId: access.session.userId,
    action: parsed.data.documentId ? "legal_doc_updated" : "legal_doc_created",
    detail: `${doc.type}: ${doc.title}`,
  });

  return NextResponse.json({ document: doc });
}
