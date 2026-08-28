import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVaultAccess } from "@/lib/vault-access";
import {
  addAudit,
  createBuyoutOffer,
  createConsensusProposal,
  executeConsensusProposal,
  getExecutionPlan,
  listBeneficiaries,
  listBuyoutOffers,
  listConsensusProposals,
  rejectConsensusProposal,
  respondToBuyout,
  signConsensusProposal,
} from "@/lib/db/store";

export async function GET() {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const [proposals, buyouts, plan, heirs] = await Promise.all([
    listConsensusProposals(access.vault.id),
    listBuyoutOffers(access.vault.id),
    getExecutionPlan(access.vault.id),
    listBeneficiaries(access.vault.id),
  ]);
  return NextResponse.json({
    proposals,
    buyouts,
    plan,
    heirs,
    trustDraft: access.vault.trustDraft,
    asAgent: access.asAgent,
    requiredApprovals: plan?.minCoSignApprovals || 2,
  });
}

const proposeSchema = z.object({
  action: z.literal("propose"),
  kind: z.enum([
    "amend_trust",
    "liquidate_share",
    "transfer_asset",
    "execute_amendment",
  ]),
  title: z.string().min(3).max(160),
  summary: z.string().max(2000).optional().default(""),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  requiredApprovals: z.number().int().min(2).max(5).optional(),
});

const signSchema = z.object({
  action: z.literal("sign"),
  proposalId: z.string(),
});

const executeSchema = z.object({
  action: z.literal("execute"),
  proposalId: z.string(),
});

const rejectSchema = z.object({
  action: z.literal("reject"),
  proposalId: z.string(),
});

const buyoutSchema = z.object({
  action: z.literal("buyout"),
  sellerBeneficiaryId: z.string(),
  assetId: z.string().nullable().optional(),
  sharePercent: z.number().min(1).max(100),
  askingPriceKes: z.number().min(1),
  windowDays: z.number().int().min(3).max(60).optional(),
});

const respondSchema = z.object({
  action: z.literal("respond"),
  offerId: z.string(),
  beneficiaryId: z.string(),
  decision: z.enum(["accept", "decline"]),
  offerKes: z.number().nullable().optional(),
});

const postSchema = z.discriminatedUnion("action", [
  proposeSchema,
  signSchema,
  executeSchema,
  rejectSchema,
  buyoutSchema,
  respondSchema,
]);

export async function POST(request: Request) {
  const access = await requireVaultAccess();
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the family consensus details." }, { status: 400 });
  }
  const body = parsed.data;

  if (body.action === "propose") {
    const proposal = await createConsensusProposal({
      vaultId: access.vault.id,
      kind: body.kind,
      title: body.title,
      summary: body.summary,
      payload: body.payload,
      proposedByUserId: access.session.userId,
      requiredApprovals: body.requiredApprovals,
    });
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "consensus_proposed",
      detail: `${body.kind}: ${body.title}`,
    });
    return NextResponse.json({ proposal }, { status: 201 });
  }

  if (body.action === "sign") {
    const result = await signConsensusProposal({
      proposalId: body.proposalId,
      vaultId: access.vault.id,
      userId: access.session.userId,
      asAgent: access.asAgent,
    });
    if (result.error) {
      return NextResponse.json({ error: result.error, proposal: result.proposal }, { status: 400 });
    }
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "consensus_signed",
      detail: `${result.proposal.title} · ${result.proposal.signatures.length}/${result.proposal.requiredApprovals}`,
    });
    return NextResponse.json(result);
  }

  if (body.action === "execute") {
    const result = await executeConsensusProposal({
      proposalId: body.proposalId,
      vaultId: access.vault.id,
      userId: access.session.userId,
    });
    if (result.error) {
      return NextResponse.json({ error: result.error, proposal: result.proposal }, { status: 400 });
    }
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "consensus_executed",
      detail: result.proposal.title,
    });
    return NextResponse.json(result);
  }

  if (body.action === "reject") {
    if (access.asAgent) {
      return NextResponse.json(
        { error: "Only the settlor can reject a proposal." },
        { status: 403 },
      );
    }
    const proposal = await rejectConsensusProposal({
      proposalId: body.proposalId,
      vaultId: access.vault.id,
    });
    return NextResponse.json({ proposal });
  }

  if (body.action === "buyout") {
    const offer = await createBuyoutOffer({
      vaultId: access.vault.id,
      sellerBeneficiaryId: body.sellerBeneficiaryId,
      assetId: body.assetId || null,
      sharePercent: body.sharePercent,
      askingPriceKes: body.askingPriceKes,
      windowDays: body.windowDays,
    });
    await addAudit({
      vaultId: access.vault.id,
      actorUserId: access.session.userId,
      action: "buyout_opened",
      detail: `${body.sharePercent}% · KES ${body.askingPriceKes}`,
    });
    return NextResponse.json({ offer }, { status: 201 });
  }

  const heirs = await listBeneficiaries(access.vault.id);
  const heir = heirs.find((h) => h.id === body.beneficiaryId);
  const result = await respondToBuyout({
    offerId: body.offerId,
    vaultId: access.vault.id,
    beneficiaryId: body.beneficiaryId,
    responderName: heir?.fullName || "Family member",
    decision: body.decision,
    offerKes: body.offerKes ?? null,
  });
  if (result.error) {
    return NextResponse.json({ error: result.error, offer: result.offer }, { status: 400 });
  }
  await addAudit({
    vaultId: access.vault.id,
    actorUserId: access.session.userId,
    action: "buyout_response",
    detail: `${body.decision} · ${heir?.fullName || body.beneficiaryId}`,
  });
  return NextResponse.json(result);
}
